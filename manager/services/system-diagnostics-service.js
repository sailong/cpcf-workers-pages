'use strict';

const dns = require('node:dns').promises;
const tls = require('node:tls');
const { getDatabase } = require('./database');
const auditService = require('./audit-service');
const { normalizeHostname, splitList } = require('../utils/project-hostname');

const DOMAIN_SETTING_KEY = 'domain_configuration_confirmation';
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const WARNING_CODES = Object.freeze({
    DOMAIN_ENVIRONMENT_INCOMPLETE: 'domain_environment_incomplete',
    CONSOLE_HOST_MISMATCH: 'console_host_mismatch',
    CLOUDFLARE_TOKEN_MISSING: 'cloudflare_token_missing',
    CONSOLE_DNS_UNRESOLVED: 'console_dns_unresolved',
    WILDCARD_DNS_UNRESOLVED: 'wildcard_dns_unresolved',
    CONSOLE_TLS_UNHEALTHY: 'console_tls_unhealthy',
    WILDCARD_TLS_UNHEALTHY: 'wildcard_tls_unhealthy',
    DOMAIN_CONFIRMATION_MISSING: 'domain_confirmation_missing'
});

function configuredDomains(environment) {
    const consoleHosts = splitList(environment.CONSOLE_HOSTS || environment.CONSOLE_HOST);
    const projectsBaseDomains = splitList(environment.PROJECTS_BASE_DOMAINS || environment.PROJECTS_BASE_DOMAIN);
    return {
        consoleHost: normalizeHostname(consoleHosts[0]),
        projectsBaseDomain: normalizeHostname(projectsBaseDomains[0])
    };
}

function certificateProbe(hostname, timeoutMs = 3_000) {
    return new Promise(resolve => {
        if (!hostname) return resolve({ ok: false, error: 'Hostname is not configured' });
        const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: false });
        const finish = result => {
            socket.removeAllListeners();
            socket.destroy();
            resolve(result);
        };
        socket.setTimeout(timeoutMs, () => finish({ ok: false, error: 'TLS probe timed out' }));
        socket.once('error', error => finish({ ok: false, error: error.message }));
        socket.once('secureConnect', () => {
            const certificate = socket.getPeerCertificate();
            const validTo = certificate.valid_to ? new Date(certificate.valid_to) : null;
            finish({
                ok: Boolean(certificate && certificate.subject),
                authorized: socket.authorized,
                authorizationError: socket.authorizationError || null,
                subject: certificate.subject?.CN || null,
                issuer: certificate.issuer?.O || certificate.issuer?.CN || null,
                validFrom: certificate.valid_from || null,
                validTo: certificate.valid_to || null,
                daysRemaining: validTo && Number.isFinite(validTo.getTime())
                    ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000)
                    : null
            });
        });
    });
}

async function dnsProbe(hostname, lookup = dns.lookup, timeoutMs = 3_000) {
    if (!hostname) return { ok: false, addresses: [], error: 'Hostname is not configured' };
    let timer;
    try {
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                const error = new Error('DNS probe timed out');
                error.code = 'ETIMEDOUT';
                reject(error);
            }, timeoutMs);
        });
        const records = await Promise.race([lookup(hostname, { all: true }), timeout]);
        return { ok: records.length > 0, addresses: [...new Set(records.map(record => record.address))] };
    } catch (error) {
        return { ok: false, addresses: [], error: error.code || error.message };
    } finally {
        clearTimeout(timer);
    }
}

function createSystemDiagnosticsService(options = {}) {
    const environment = options.environment || process.env;
    const db = options.db || getDatabase();
    const lookup = options.lookup || dns.lookup;
    const probeCertificate = options.probeCertificate || certificateProbe;
    const dnsTimeoutMs = options.dnsTimeoutMs || 3_000;
    const audit = options.audit || auditService;
    const now = options.now || (() => new Date());

    function getConfirmation() {
        const row = db.prepare('SELECT value, updated_at FROM settings WHERE key = ?').get(DOMAIN_SETTING_KEY);
        if (!row) return null;
        try { return { ...JSON.parse(row.value), updatedAt: row.updated_at }; } catch { return null; }
    }

    async function getStatus(observedHost) {
        const domains = configuredDomains(environment);
        const observed = normalizeHostname(observedHost);
        const wildcardProbeHost = domains.projectsBaseDomain ? `health-worker.${domains.projectsBaseDomain}` : '';
        const [consoleDns, wildcardDns, consoleTls, wildcardTls] = await Promise.all([
            dnsProbe(domains.consoleHost, lookup, dnsTimeoutMs),
            dnsProbe(wildcardProbeHost, lookup, dnsTimeoutMs),
            probeCertificate(domains.consoleHost),
            probeCertificate(wildcardProbeHost)
        ]);
        const confirmation = getConfirmation();
        const confirmed = Boolean(confirmation
            && confirmation.consoleHost === domains.consoleHost
            && confirmation.projectsBaseDomain === domains.projectsBaseDomain);
        const warnings = [];
        if (!domains.consoleHost || !domains.projectsBaseDomain) warnings.push(WARNING_CODES.DOMAIN_ENVIRONMENT_INCOMPLETE);
        if (observed && domains.consoleHost && observed !== domains.consoleHost && !['localhost', '127.0.0.1', '::1'].includes(observed)) {
            warnings.push(WARNING_CODES.CONSOLE_HOST_MISMATCH);
        }
        if (!environment.CLOUDFLARE_API_TOKEN) warnings.push(WARNING_CODES.CLOUDFLARE_TOKEN_MISSING);
        if (!consoleDns.ok) warnings.push(WARNING_CODES.CONSOLE_DNS_UNRESOLVED);
        if (!wildcardDns.ok) warnings.push(WARNING_CODES.WILDCARD_DNS_UNRESOLVED);
        if (!consoleTls.ok || !consoleTls.authorized) warnings.push(WARNING_CODES.CONSOLE_TLS_UNHEALTHY);
        if (!wildcardTls.ok || !wildcardTls.authorized) warnings.push(WARNING_CODES.WILDCARD_TLS_UNHEALTHY);
        if (!confirmed) warnings.push(WARNING_CODES.DOMAIN_CONFIRMATION_MISSING);

        return {
            configuration: {
                consoleHost: domains.consoleHost,
                projectsBaseDomain: domains.projectsBaseDomain,
                projectWildcard: domains.projectsBaseDomain ? `*.${domains.projectsBaseDomain}` : '',
                observedHost: observed,
                observedHostMatches: !observed || observed === domains.consoleHost,
                dnsProviderConfigured: Boolean(environment.CLOUDFLARE_API_TOKEN),
                acmeEmailConfigured: Boolean(environment.ACME_EMAIL),
                ingressProxyConfigured: Boolean(environment.INGRESS_PROXY_TOKEN),
                confirmation: confirmation ? { ...confirmation, confirmed } : { confirmed: false }
            },
            dns: { console: consoleDns, wildcard: wildcardDns, probeHost: wildcardProbeHost },
            tls: { console: consoleTls, wildcard: wildcardTls, probeHost: wildcardProbeHost },
            warnings,
            healthy: warnings.length === 0,
            checkedAt: now().toISOString()
        };
    }

    function confirm({ consoleHost, projectsBaseDomain }, observedHost) {
        const configured = configuredDomains(environment);
        const normalized = {
            consoleHost: normalizeHostname(consoleHost),
            projectsBaseDomain: normalizeHostname(projectsBaseDomain)
        };
        if (!HOSTNAME_PATTERN.test(normalized.consoleHost) || !HOSTNAME_PATTERN.test(normalized.projectsBaseDomain)) {
            const error = new Error('Invalid console host or projects base domain');
            error.statusCode = 400;
            throw error;
        }
        if (normalized.consoleHost !== configured.consoleHost || normalized.projectsBaseDomain !== configured.projectsBaseDomain) {
            const error = new Error('Domain values must match the active environment and Caddy configuration');
            error.statusCode = 409;
            throw error;
        }
        const observed = normalizeHostname(observedHost);
        if (environment.NODE_ENV === 'production' && observed !== configured.consoleHost) {
            const error = new Error('Confirm domains from the configured console host');
            error.statusCode = 409;
            throw error;
        }
        const confirmedAt = now().toISOString();
        const value = { ...normalized, confirmedAt, confirmedFromHost: observed };
        db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
            .run(DOMAIN_SETTING_KEY, JSON.stringify(value), confirmedAt);
        audit.record('system.domain_confirm', 'system', null, normalized);
        return { ...value, confirmed: true, updatedAt: confirmedAt };
    }

    return { confirm, getStatus };
}

let singleton;
function service() {
    if (!singleton) singleton = createSystemDiagnosticsService();
    return singleton;
}

module.exports = {
    DOMAIN_SETTING_KEY,
    WARNING_CODES,
    certificateProbe,
    createSystemDiagnosticsService,
    dnsProbe,
    confirm: (...args) => service().confirm(...args),
    getStatus: (...args) => service().getStatus(...args)
};
