'use strict';

const { normalizeHostname, parseProjectHostname, splitList } = require('../utils/project-hostname');

function configureTrustedProxy(app, value = process.env.TRUST_PROXY) {
    if (!value || value === 'false') {
        app.set('trust proxy', false);
        return;
    }
    if (value === 'true' || value === '*') {
        throw new Error('TRUST_PROXY must list trusted proxy addresses or named ranges; blanket trust is forbidden');
    }
    app.set('trust proxy', splitList(value));
}

function createHostGuard(options = {}) {
    const consoleHosts = new Set((options.consoleHosts || splitList(process.env.CONSOLE_HOSTS, [
        'localhost', '127.0.0.1', '::1'
    ])).map(normalizeHostname));
    const projectsBaseDomains = (options.projectsBaseDomains || splitList(
        process.env.PROJECTS_BASE_DOMAINS || process.env.PROJECTS_BASE_DOMAIN,
        ['localhost']
    )).map(normalizeHostname);

    return function hostGuard(req, res, next) {
        const hostname = normalizeHostname(req.hostname);
        const consoleMatch = consoleHosts.has(hostname);
        const projectMatch = Boolean(parseProjectHostname(hostname, projectsBaseDomains));

        if (!consoleMatch && !projectMatch) {
            return res.status(421).json({ error: 'Host is not allowed' });
        }
        next();
    };
}

function securityHeaders(req, res, next) {
    res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:");
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
}

function requestOrigin(req) {
    let protocol = req.protocol;
    if (req.ccfwpTrustedIngress) {
        const forwardedProtocol = String(req.get('x-forwarded-proto') || '').trim().toLowerCase();
        if (forwardedProtocol) protocol = forwardedProtocol;
    }
    if (protocol !== 'http' && protocol !== 'https') return null;

    const host = req.get('host');
    if (!host) return null;
    try {
        return new URL(`${protocol}://${host}`).origin;
    } catch {
        return null;
    }
}

function sameOrigin(req, res, next) {
    const origin = req.headers.origin;
    if (!origin) return next();

    let parsed;
    try {
        parsed = new URL(origin);
    } catch {
        return res.status(403).json({ error: 'Invalid Origin' });
    }

    const expectedOrigin = requestOrigin(req);
    if (!expectedOrigin || parsed.origin !== expectedOrigin) {
        return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        return res.sendStatus(204);
    }
    next();
}

module.exports = {
    configureTrustedProxy,
    createHostGuard,
    sameOrigin,
    securityHeaders,
    splitList
};
