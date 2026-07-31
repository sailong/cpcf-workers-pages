'use strict';

const crypto = require('node:crypto');

function isLoopback(address) {
    const value = String(address || '').toLowerCase();
    return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

function tokenMatches(actual, expected) {
    if (typeof actual !== 'string' || typeof expected !== 'string') return false;
    const actualDigest = crypto.createHash('sha256').update(actual).digest();
    const expectedDigest = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(actualDigest, expectedDigest);
}

function assertProductionIngressConfigured(environment = process.env) {
    if (environment.NODE_ENV !== 'production') return;
    if (typeof environment.INGRESS_PROXY_TOKEN !== 'string' || environment.INGRESS_PROXY_TOKEN.length < 32) {
        throw new Error('INGRESS_PROXY_TOKEN must contain at least 32 characters in production');
    }
    if (!environment.CONSOLE_HOSTS && !environment.CONSOLE_HOST) {
        throw new Error('CONSOLE_HOST or CONSOLE_HOSTS is required in production');
    }
    if (!environment.PROJECTS_BASE_DOMAIN && !environment.PROJECTS_BASE_DOMAINS) {
        throw new Error('PROJECTS_BASE_DOMAIN is required in production');
    }
}

function createIngressGuard(options = {}) {
    const required = options.required ?? process.env.NODE_ENV === 'production';
    const expected = options.token ?? process.env.INGRESS_PROXY_TOKEN;
    const allowLoopback = options.allowLoopback !== false;
    return function ingressGuard(req, res, next) {
        if (!required || (allowLoopback && isLoopback(req.socket.remoteAddress))) return next();
        const provided = req.get('x-ccfwp-ingress-token');
        if (!tokenMatches(provided, expected)) {
            return res.status(403).json({ error: 'Request did not arrive through the trusted ingress' });
        }
        next();
    };
}

module.exports = { assertProductionIngressConfigured, createIngressGuard, isLoopback, tokenMatches };
