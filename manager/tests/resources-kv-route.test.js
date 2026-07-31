'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const resourceService = require('../services/resource-service');
const runtimeService = require('../services/runtime-service');
const router = require('../routes/resources-kv');

async function request(app, route, options = {}) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    try {
        return await new Promise((resolve, reject) => {
            const body = options.body === undefined ? null : JSON.stringify(options.body);
            const req = http.request(`http://127.0.0.1:${server.address().port}${route}`, {
                method: options.method || 'GET',
                headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
            }, response => {
                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => resolve({
                    status: response.statusCode,
                    body: JSON.parse(Buffer.concat(chunks).toString())
                }));
            });
            req.on('error', reject);
            if (body) req.write(body);
            req.end();
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test('KV routes preserve cursor, expiration, metadata, and JSON encoding semantics', async () => {
    const originalGetKV = resourceService.getKV;
    const originalWithResource = runtimeService.resourceRuntime.withResource;
    const calls = [];
    const namespace = {
        list: async options => { calls.push(['list', options]); return { keys: [], list_complete: true }; },
        put: async (key, value, options) => calls.push(['put', key, value, options]),
        getWithMetadata: async () => ({ value: '{"ok":true}', metadata: { ccfwpEncoding: 'json', source: 'test' } })
    };
    const app = express().use(express.json()).use('/api/kv', router);
    resourceService.getKV = () => [{ id: 'kv-one', name: 'one' }];
    runtimeService.resourceRuntime.withResource = async (kind, id, operation) => operation(namespace);

    try {
        const listed = await request(app, '/api/kv/kv-one/keys?prefix=app&limit=25&cursor=next-page');
        assert.equal(listed.status, 200);
        assert.deepEqual(calls[0], ['list', { prefix: 'app', limit: 25, cursor: 'next-page' }]);

        const saved = await request(app, '/api/kv/kv-one/values/settings', {
            method: 'PUT',
            body: { value: { ok: true }, metadata: { source: 'console' }, expiration: 1_900_000_000 }
        });
        assert.equal(saved.status, 200);
        assert.deepEqual(calls[1], ['put', 'settings', '{"ok":true}', {
            metadata: { source: 'console', ccfwpEncoding: 'json' },
            expiration: 1_900_000_000
        }]);

        const loaded = await request(app, '/api/kv/kv-one/values/settings');
        assert.equal(loaded.status, 200);
        assert.deepEqual(loaded.body, {
            value: { ok: true },
            metadata: { ccfwpEncoding: 'json', source: 'test' }
        });

        namespace.list = async () => {
            const error = new Error('rate limited');
            error.statusCode = 429;
            throw error;
        };
        const failure = await request(app, '/api/kv/kv-one/keys');
        assert.equal(failure.status, 429);
        assert.deepEqual(failure.body, { error: 'rate limited' });
    } finally {
        resourceService.getKV = originalGetKV;
        runtimeService.resourceRuntime.withResource = originalWithResource;
    }
});
