'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ResourceRuntime } = require('../services/resource-runtime');
const { ResourceGatewayServer } = require('../services/resource-gateway-server');
const { encode, decode } = require('../services/resource-gateway-codec');

function project(id, bindings) {
    return { id, bindings, limits: { uploadMb: 6 } };
}

async function post(baseUrl, projectId, kind, resourceId, operation, body, token = `token-${projectId}`) {
    const response = await fetch(`${baseUrl}/v1/${projectId}/${kind}/${resourceId}/${operation}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(encode(body || {}))
    });
    return { response, body: decode(await response.json()) };
}

async function uploadPart(baseUrl, projectId, resourceId, upload, partNumber, value) {
    const response = await fetch(`${baseUrl}/v1/${projectId}/r2/${resourceId}/upload-part`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer token-${projectId}`,
            'Content-Type': 'application/octet-stream',
            'X-CCFWP-Key': Buffer.from(upload.key).toString('base64'),
            'X-CCFWP-Upload-Id': Buffer.from(upload.uploadId).toString('base64'),
            'X-CCFWP-Part-Number': String(partNumber)
        },
        body: value
    });
    return { response, body: decode(await response.json()) };
}

async function putObject(baseUrl, projectId, resourceId, key, value, options = {}) {
    const response = await fetch(`${baseUrl}/v1/${projectId}/r2/${resourceId}/put`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer token-${projectId}`,
            'Content-Type': 'application/octet-stream',
            'X-CCFWP-Key': Buffer.from(key).toString('base64'),
            'X-CCFWP-Options': Buffer.from(JSON.stringify(encode(options))).toString('base64url')
        },
        body: value
    });
    return { response, body: decode(await response.json()) };
}

async function getObject(baseUrl, projectId, resourceId, key, options = {}) {
    return fetch(`${baseUrl}/v1/${projectId}/r2/${resourceId}/get`, {
        method: 'POST',
        headers: { Authorization: `Bearer token-${projectId}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(encode({ key, options }))
    });
}

test('resource gateway shares explicitly bound state and rejects unbound or invalid-token access', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-resource-gateway-'));
    const resources = {
        kv: [{ id: 'kv-shared', name: 'shared' }],
        d1: [{ id: 'd1-shared', name: 'shared' }],
        r2: [{ id: 'r2-shared', name: 'shared' }]
    };
    const allBindings = {
        kv: [{ varName: 'CACHE', resourceId: 'kv-shared' }],
        d1: [{ varName: 'DB', resourceId: 'd1-shared' }],
        r2: [{ varName: 'BUCKET', resourceId: 'r2-shared' }]
    };
    const projects = new Map([
        ['one', project('one', allBindings)],
        ['two', project('two', allBindings)],
        ['unbound', project('unbound', { kv: [], d1: [], r2: [] })]
    ]);
    const runtime = new ResourceRuntime({
        wranglerPersistDir: path.join(root, 'shared'),
        r2PersistDir: path.join(root, 'r2'),
        kvDataDir: path.join(root, 'legacy')
    });
    const gateway = new ResourceGatewayServer({
        host: '127.0.0.1', port: 0, resourceRuntime: runtime,
        projectService: { getById: id => projects.get(id) },
        auth: {
            initialize: async () => {},
            verifyProjectToken: (id, token) => token === `token-${id}`
        }
    });
    try {
        await runtime.start(resources);
        const { port } = await gateway.start();
        const baseUrl = `http://127.0.0.1:${port}`;

        let result = await post(baseUrl, 'one', 'kv', 'kv-shared', 'put', { key: 'shared', value: 'visible' });
        assert.equal(result.response.status, 200);
        result = await post(baseUrl, 'two', 'kv', 'kv-shared', 'get', { key: 'shared' });
        assert.equal(Buffer.from(result.body.value).toString(), 'visible');

        for (const key of ['page-a', 'page-b', 'page-c']) {
            result = await post(baseUrl, 'one', 'kv', 'kv-shared', 'put', {
                key,
                value: `value-${key}`,
                options: { expirationTtl: 60, metadata: { ordinal: key.at(-1) } }
            });
            assert.equal(result.response.status, 200);
        }
        result = await post(baseUrl, 'two', 'kv', 'kv-shared', 'get', { key: 'page-a' });
        assert.equal(Buffer.from(result.body.value).toString(), 'value-page-a');
        assert.deepEqual(result.body.metadata, { ordinal: 'a' });
        const firstKVPage = await post(baseUrl, 'one', 'kv', 'kv-shared', 'list', {
            options: { prefix: 'page-', limit: 2 }
        });
        assert.equal(firstKVPage.body.list_complete, false);
        assert.equal(firstKVPage.body.keys.length, 2);
        assert.equal(typeof firstKVPage.body.cursor, 'string');
        assert.deepEqual(firstKVPage.body.keys[0].metadata, { ordinal: 'a' });
        assert.equal(typeof firstKVPage.body.keys[0].expiration, 'number');
        assert.ok(firstKVPage.body.keys[0].expiration >= Math.floor(Date.now() / 1000) + 55);
        assert.ok(firstKVPage.body.keys[0].expiration <= Math.floor(Date.now() / 1000) + 65);
        const secondKVPage = await post(baseUrl, 'one', 'kv', 'kv-shared', 'list', {
            options: { prefix: 'page-', limit: 2, cursor: firstKVPage.body.cursor }
        });
        assert.equal(secondKVPage.body.list_complete, true);
        assert.equal(secondKVPage.body.keys.length, 1);

        result = await post(baseUrl, 'unbound', 'kv', 'kv-shared', 'get', { key: 'shared' });
        assert.equal(result.response.status, 403);
        result = await post(baseUrl, 'one', 'kv', 'kv-shared', 'get', { key: 'shared' }, 'wrong');
        assert.equal(result.response.status, 401);

        const malformedPath = await fetch(`${baseUrl}/v1/%E0%A4%A/kv/kv-shared/get`, { method: 'POST' });
        assert.equal(malformedPath.status, 400);
        assert.deepEqual(await malformedPath.json(), { error: 'Malformed resource gateway path' });

        const malformedOptions = await fetch(`${baseUrl}/v1/one/r2/r2-shared/put`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer token-one',
                'X-CCFWP-Key': Buffer.from('key').toString('base64'),
                'X-CCFWP-Options': 'not-json'
            },
            body: 'value'
        });
        assert.equal(malformedOptions.status, 400);
        assert.deepEqual(await malformedOptions.json(), { error: 'Invalid R2 options header' });

        await post(baseUrl, 'one', 'd1', 'd1-shared', 'exec', { query: 'CREATE TABLE items(id INTEGER PRIMARY KEY, value TEXT)' });
        await Promise.all(Array.from({ length: 10 }, (_, index) => post(baseUrl, 'one', 'd1', 'd1-shared', 'query', {
            query: 'INSERT INTO items(value) VALUES (?)', bindings: [`value-${index}`], method: 'run'
        })));
        result = await post(baseUrl, 'two', 'd1', 'd1-shared', 'query', {
            query: 'SELECT COUNT(*) AS count FROM items', method: 'first', column: 'count'
        });
        assert.equal(result.body, 10);
        const batch = await post(baseUrl, 'one', 'd1', 'd1-shared', 'batch', {
            statements: [
                { query: 'INSERT INTO items(value) VALUES (?)', bindings: ['batch-value'] },
                { query: 'SELECT value FROM items WHERE value = ?', bindings: ['batch-value'] }
            ]
        });
        assert.equal(batch.body.length, 2);
        assert.equal(batch.body[0].success, true);
        assert.deepEqual(batch.body[1].results, [{ value: 'batch-value' }]);
        result = await post(baseUrl, 'one', 'd1', 'd1-shared', 'query', {
            query: 'SELECT id, value FROM items ORDER BY id LIMIT 1', method: 'raw', options: { columnNames: true }
        });
        assert.deepEqual(result.body[0], ['id', 'value']);

        const storedObject = await putObject(baseUrl, 'one', 'r2-shared', 'range.txt', '0123456789', {
            httpMetadata: { contentType: 'text/plain' },
            customMetadata: { source: 'range-test' }
        });
        assert.equal(storedObject.response.status, 200);
        const headObject = await post(baseUrl, 'two', 'r2', 'r2-shared', 'head', { key: 'range.txt' });
        assert.equal(headObject.body.size, 10);
        assert.equal(headObject.body.httpMetadata.contentType, 'text/plain');
        assert.deepEqual(headObject.body.customMetadata, { source: 'range-test' });
        const rangeObject = await getObject(baseUrl, 'two', 'r2-shared', 'range.txt', { range: { offset: 2, length: 4 } });
        assert.equal(rangeObject.status, 200);
        assert.equal(await rangeObject.text(), '2345');
        const rangeMetadata = decode(JSON.parse(Buffer.from(rangeObject.headers.get('x-ccfwp-r2-metadata'), 'base64url').toString('utf8')));
        assert.deepEqual(rangeMetadata.range, { offset: 2, length: 4 });

        await putObject(baseUrl, 'one', 'r2-shared', 'range-2.txt', 'second');
        const firstR2Page = await post(baseUrl, 'one', 'r2', 'r2-shared', 'list', {
            options: { prefix: 'range', limit: 1 }
        });
        assert.equal(firstR2Page.body.objects.length, 1);
        assert.equal(firstR2Page.body.truncated, true);
        assert.equal(typeof firstR2Page.body.cursor, 'string');
        const secondR2Page = await post(baseUrl, 'one', 'r2', 'r2-shared', 'list', {
            options: { prefix: 'range', limit: 1, cursor: firstR2Page.body.cursor }
        });
        assert.equal(secondR2Page.body.objects.length, 1);

        const created = await post(baseUrl, 'one', 'r2', 'r2-shared', 'create-multipart', {
            key: 'multipart.txt', options: { customMetadata: { source: 'test' } }
        });
        assert.equal(created.response.status, 200);
        assert.equal(created.body.key, 'multipart.txt');
        assert.equal(typeof created.body.uploadId, 'string');
        const firstPartValue = Buffer.alloc(5 * 1024 * 1024, 'm');
        const firstPart = await uploadPart(baseUrl, 'one', 'r2-shared', created.body, 1, firstPartValue);
        const secondPart = await uploadPart(baseUrl, 'two', 'r2-shared', created.body, 2, 'value');
        assert.equal(firstPart.response.status, 200);
        assert.equal(secondPart.response.status, 200);
        assert.deepEqual(Object.keys(firstPart.body).sort(), ['etag', 'partNumber']);
        assert.equal(secondPart.body.partNumber, 2);
        const completed = await post(baseUrl, 'two', 'r2', 'r2-shared', 'complete-multipart', {
            key: created.body.key,
            uploadId: created.body.uploadId,
            uploadedParts: [firstPart.body, secondPart.body]
        });
        assert.equal(completed.response.status, 200);
        assert.equal(completed.body.key, 'multipart.txt');
        assert.equal(completed.body.size, firstPartValue.length + Buffer.byteLength('value'));
        assert.deepEqual(completed.body.customMetadata, { source: 'test' });

        const downloaded = await fetch(`${baseUrl}/v1/two/r2/r2-shared/get`, {
            method: 'POST',
            headers: { Authorization: 'Bearer token-two', 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'multipart.txt' })
        });
        assert.equal(downloaded.status, 200);
        const downloadedValue = Buffer.from(await downloaded.arrayBuffer());
        assert.equal(downloadedValue.length, firstPartValue.length + Buffer.byteLength('value'));
        assert.equal(downloadedValue.subarray(-5).toString(), 'value');

        const deleted = await post(baseUrl, 'one', 'r2', 'r2-shared', 'delete', {
            keys: ['range-2.txt', 'multipart.txt']
        });
        assert.equal(deleted.response.status, 200);
        assert.equal((await post(baseUrl, 'two', 'r2', 'r2-shared', 'head', { key: 'range-2.txt' })).body, null);
        assert.equal((await post(baseUrl, 'two', 'r2', 'r2-shared', 'head', { key: 'multipart.txt' })).body, null);

        const abandoned = await post(baseUrl, 'one', 'r2', 'r2-shared', 'create-multipart', { key: 'abandoned.txt' });
        const aborted = await post(baseUrl, 'two', 'r2', 'r2-shared', 'abort-multipart', {
            key: abandoned.body.key,
            uploadId: abandoned.body.uploadId
        });
        assert.equal(aborted.response.status, 200);
    } finally {
        await gateway.stop();
        await runtime.dispose();
        fs.rmSync(root, { recursive: true, force: true });
    }
});


test('resource gateway rejects malformed KV, D1, and R2 request fields with 400', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-resource-gateway-validation-'));
    const runtime = new ResourceRuntime({
        wranglerPersistDir: path.join(root, 'shared'),
        r2PersistDir: path.join(root, 'r2'),
        kvDataDir: path.join(root, 'legacy-kv'),
        logger: { error() {} }
    });
    const resources = {
        kv: [{ id: 'kv-shared', name: 'shared' }],
        d1: [{ id: 'd1-shared', name: 'shared' }],
        r2: [{ id: 'r2-shared', name: 'shared' }]
    };
    await runtime.start(resources);
    const gateway = new ResourceGatewayServer({
        host: '127.0.0.1',
        port: 0,
        projectService: {
            getById: id => id === 'one' ? project('one', {
                kv: [{ varName: 'KV', resourceId: 'kv-shared' }],
                d1: [{ varName: 'DB', resourceId: 'd1-shared' }],
                r2: [{ varName: 'BUCKET', resourceId: 'r2-shared' }]
            }) : null
        },
        resourceRuntime: runtime,
        auth: {
            initialize: async () => {},
            verifyProjectToken: (projectId, token) => token === `token-${projectId}`
        }
    });
    try {
        const address = await gateway.start();
        const baseUrl = `http://127.0.0.1:${address.port}`;

        let result = await post(baseUrl, 'one', 'kv', 'kv-shared', 'get', {});
        assert.equal(result.response.status, 400);
        assert.equal(result.body.error, 'key is required');

        result = await post(baseUrl, 'one', 'kv', 'kv-shared', 'put', { key: 'a', value: 123 });
        assert.equal(result.response.status, 400);
        assert.equal(result.body.error, 'value must be a string or bytes');

        result = await post(baseUrl, 'one', 'd1', 'd1-shared', 'query', { bindings: [] });
        assert.equal(result.response.status, 400);
        assert.equal(result.body.error, 'query is required');

        result = await post(baseUrl, 'one', 'd1', 'd1-shared', 'batch', { statements: 'nope' });
        assert.equal(result.response.status, 400);
        assert.equal(result.body.error, 'statements must be an array');

        result = await post(baseUrl, 'one', 'r2', 'r2-shared', 'get', {});
        assert.equal(result.response.status, 400);
        assert.equal(result.body.error, 'key is required');

        result = await post(baseUrl, 'one', 'r2', 'r2-shared', 'delete', { keys: [1] });
        assert.equal(result.response.status, 400);
        assert.match(result.body.error, /keys\[0\]/);
    } finally {
        await gateway.stop();
        await runtime.dispose();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
