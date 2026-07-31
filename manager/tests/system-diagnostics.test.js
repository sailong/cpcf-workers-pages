'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../services/database');
const { createAuditService } = require('../services/audit-service');
const { WARNING_CODES, createSystemDiagnosticsService, dnsProbe } = require('../services/system-diagnostics-service');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-system-diagnostics-'));
    const db = createDatabase({
        databaseFile: path.join(root, 'control-plane.sqlite3'),
        projectsFile: path.join(root, 'missing-projects.json'),
        resourcesFile: path.join(root, 'missing-resources.json')
    });
    const environment = {
        NODE_ENV: 'production',
        CONSOLE_HOST: 'console.example.com',
        CONSOLE_HOSTS: 'console.example.com',
        PROJECTS_BASE_DOMAIN: 'apps.example.com',
        CLOUDFLARE_API_TOKEN: 'must-never-leak',
        INGRESS_PROXY_TOKEN: 'must-never-leak-either',
        ACME_EMAIL: 'admin@example.com'
    };
    const service = createSystemDiagnosticsService({
        db,
        environment,
        lookup: async () => [{ address: '203.0.113.10', family: 4 }],
        probeCertificate: async hostname => ({
            ok: true,
            authorized: true,
            subject: hostname,
            issuer: 'Test CA',
            validTo: 'Aug 30 00:00:00 2026 GMT',
            daysRemaining: 30
        }),
        audit: createAuditService({ db, now: () => new Date('2026-07-30T00:00:00.000Z') }),
        now: () => new Date('2026-07-30T00:00:00.000Z')
    });
    return {
        db,
        service,
        cleanup() {
            db.close();
            fs.rmSync(root, { recursive: true, force: true });
        }
    };
}

test('system diagnostics report DNS and TLS health without returning configured secrets', async () => {
    const f = fixture();
    try {
        const status = await f.service.getStatus('console.example.com');
        assert.equal(status.configuration.observedHostMatches, true);
        assert.equal(status.configuration.dnsProviderConfigured, true);
        assert.equal(status.dns.wildcard.ok, true);
        assert.equal(status.tls.console.authorized, true);
        assert.equal(status.healthy, false);
        assert.deepEqual(status.warnings, [WARNING_CODES.DOMAIN_CONFIRMATION_MISSING]);
        assert.doesNotMatch(JSON.stringify(status), /must-never-leak/);
    } finally {
        f.cleanup();
    }
});

test('domain confirmation accepts only the active Caddy environment and records an audit event', async () => {
    const f = fixture();
    try {
        assert.throws(() => f.service.confirm({
            consoleHost: 'other.example.com',
            projectsBaseDomain: 'apps.example.com'
        }, 'console.example.com'), /must match the active environment/);

        const confirmation = f.service.confirm({
            consoleHost: 'console.example.com',
            projectsBaseDomain: 'apps.example.com'
        }, 'console.example.com');
        assert.equal(confirmation.confirmed, true);

        const status = await f.service.getStatus('console.example.com');
        assert.equal(status.configuration.confirmation.confirmed, true);
        assert.equal(status.healthy, true);
        const audit = f.db.prepare('SELECT action, details FROM audit_events').get();
        assert.equal(audit.action, 'system.domain_confirm');
        assert.deepEqual(JSON.parse(audit.details), {
            consoleHost: 'console.example.com',
            projectsBaseDomain: 'apps.example.com'
        });
    } finally {
        f.cleanup();
    }
});

test('DNS probes return a bounded timeout when the resolver does not settle', async () => {
    const startedAt = Date.now();
    const result = await dnsProbe('stalled.example.com', () => new Promise(() => {}), 20);
    assert.deepEqual(result, { ok: false, addresses: [], error: 'ETIMEDOUT' });
    assert.ok(Date.now() - startedAt < 500);
});
