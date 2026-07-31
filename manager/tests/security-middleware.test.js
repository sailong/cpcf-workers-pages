'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const { createHostGuard, sameOrigin, securityHeaders } = require('../middleware/security');
const { parseProjectHostname } = require('../utils/project-hostname');
const { assertProductionIngressConfigured, createIngressGuard } = require('../middleware/ingress');

test('project hostnames match exactly one allowed base-domain label', () => {
    const bases = ['apps.example.test'];
    assert.deepEqual(parseProjectHostname('Demo-Worker.apps.example.test.', bases), {
        projectName: 'demo', projectType: 'worker', baseDomain: 'apps.example.test'
    });
    assert.equal(parseProjectHostname('demo-worker.evil.test', bases), null);
    assert.equal(parseProjectHostname('demo-worker.apps.example.test.evil.test', bases), null);
    assert.equal(parseProjectHostname('nested.demo-worker.apps.example.test', bases), null);
    assert.equal(parseProjectHostname('-worker.apps.example.test', bases), null);
});

test('production ingress requires explicit domain settings and a trusted proxy token', () => {
    assert.throws(() => assertProductionIngressConfigured({ NODE_ENV: 'production' }), /INGRESS_PROXY_TOKEN/);
    assert.throws(() => assertProductionIngressConfigured({
        NODE_ENV: 'production', INGRESS_PROXY_TOKEN: 'x'.repeat(32)
    }), /CONSOLE_HOST/);
    assert.doesNotThrow(() => assertProductionIngressConfigured({
        NODE_ENV: 'production',
        INGRESS_PROXY_TOKEN: 'x'.repeat(32),
        CONSOLE_HOST: 'console.example.test',
        PROJECTS_BASE_DOMAIN: 'apps.example.test'
    }));
});

test('production ingress rejects direct non-loopback requests without the shared proxy token', () => {
    const guard = createIngressGuard({ required: true, token: 'x'.repeat(32), allowLoopback: false });
    let status;
    guard({ get: () => undefined, socket: { remoteAddress: '10.0.0.8' } }, {
        status(code) { status = code; return this; },
        json() {}
    }, () => { throw new Error('unexpected next'); });
    assert.equal(status, 403);

    let passed = false;
    guard({ get: () => 'x'.repeat(32), socket: { remoteAddress: '10.0.0.8' } }, {}, () => { passed = true; });
    assert.equal(passed, true);
});

async function withServer(run) {
    const app = express();
    app.set('trust proxy', false);
    app.use(securityHeaders);
    app.use(createHostGuard({ consoleHosts: ['console.example.test'], projectsBaseDomains: ['apps.example.test'] }));
    app.use(sameOrigin);
    app.use(express.json({ limit: '32b', strict: true }));
    app.use((req, res) => res.json({ ok: true }));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: error.message });
    });

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

test('host allowlist, same-origin policy, security headers, and JSON limit are enforced', async () => {
    await withServer(async baseUrl => {
        const allowed = await request(baseUrl, { headers: { Host: 'console.example.test' } });
        assert.equal(allowed.status, 200);
        assert.equal(allowed.headers['x-content-type-options'], 'nosniff');
        assert.match(allowed.headers['content-security-policy'], /frame-ancestors 'none'/);
        assert.equal(allowed.headers['strict-transport-security'], undefined);

        const previousNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            const production = await request(baseUrl, { headers: { Host: 'console.example.test' } });
            assert.match(production.headers['strict-transport-security'], /max-age=31536000/);
        } finally {
            if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previousNodeEnv;
        }

        assert.equal((await request(baseUrl, { headers: { Host: 'demo-worker.apps.example.test' } })).status, 200);
        assert.equal((await request(baseUrl, { headers: { Host: 'console.example.test', 'X-Forwarded-Host': 'evil.example.test' } })).status, 200);
        assert.equal((await request(baseUrl, { headers: { Host: 'attacker.example.test' } })).status, 421);
        assert.equal((await request(baseUrl, {
            method: 'POST',
            headers: { Host: 'console.example.test', Origin: 'https://evil.example.test', 'Content-Type': 'application/json' },
            body: '{}'
        })).status, 403);
        assert.equal((await request(baseUrl, {
            method: 'POST',
            headers: { Host: 'console.example.test', 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: 'x'.repeat(64) })
        })).status, 413);
    });
});

test('project traffic reaches the runtime before console CORS and security headers', async () => {
    const app = express();
    app.use(createHostGuard({ consoleHosts: ['console.example.test'], projectsBaseDomains: ['apps.example.test'] }));
    app.use((req, res, next) => {
        if (req.hostname.endsWith('.apps.example.test')) return res.json({ runtime: true });
        next();
    });
    app.use(securityHeaders);
    app.use(sameOrigin);
    app.use((req, res) => res.json({ console: true }));

    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        const result = await request(`http://127.0.0.1:${server.address().port}`, {
            method: 'POST',
            headers: { Host: 'demo-worker.apps.example.test', Origin: 'https://consumer.example.test' }
        });
        assert.equal(result.status, 200);
        assert.equal(JSON.parse(result.body).runtime, true);
        assert.equal(result.headers['content-security-policy'], undefined);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
