'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ResourceRuntime } = require('../services/resource-runtime');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-resource-runtime-'));
    return {
        root,
        runtime: new ResourceRuntime({
            wranglerPersistDir: path.join(root, 'shared'),
            r2PersistDir: path.join(root, 'r2'),
            kvDataDir: path.join(root, 'legacy-kv'),
            logger: { error() {} }
        }),
        resources: {
            kv: [{ id: 'kv-one', name: 'one' }],
            d1: [{ id: 'd1-one', name: 'one' }],
            r2: [{ id: 'r2-one', name: 'one' }]
        }
    };
}

test('one resource runtime owns canonical KV, D1, and R2 state under concurrent access', async () => {
    const { root, runtime, resources } = fixture();
    try {
        await runtime.start(resources);
        await Promise.all(Array.from({ length: 20 }, (_, index) => runtime.withResource('kv', 'kv-one',
            namespace => namespace.put(`key-${index}`, `value-${index}`))));
        const kv = await runtime.withResource('kv', 'kv-one', namespace => namespace.list());
        assert.equal(kv.keys.length, 20);

        await runtime.withResource('d1', 'd1-one', database => database.exec(
            'CREATE TABLE entries (id INTEGER PRIMARY KEY, value TEXT NOT NULL)'
        ));
        await Promise.all(Array.from({ length: 20 }, (_, index) => runtime.withResource('d1', 'd1-one',
            database => database.prepare('INSERT INTO entries(value) VALUES (?)').bind(`value-${index}`).run())));
        const rows = await runtime.withResource('d1', 'd1-one',
            database => database.prepare('SELECT COUNT(*) AS count FROM entries').first());
        assert.equal(rows.count, 20);

        await Promise.all(Array.from({ length: 20 }, (_, index) => runtime.withResource('r2', 'r2-one',
            bucket => bucket.put(`object-${index}`, `value-${index}`))));
        const r2 = await runtime.withResource('r2', 'r2-one', bucket => bucket.list());
        assert.equal(r2.objects.length, 20);
    } finally {
        await runtime.dispose();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('resource synchronization preserves trashed data and revokes removed resources', async () => {
    const { root, runtime, resources } = fixture();
    try {
        await runtime.start(resources);
        await runtime.withResource('kv', 'kv-one', namespace => namespace.put('preserved', 'yes'));
        await runtime.sync({ ...resources, kv: [{ ...resources.kv[0], deletedAt: new Date().toISOString() }] });
        assert.equal(await runtime.withResource('kv', 'kv-one', namespace => namespace.get('preserved')), 'yes');

        await runtime.sync({ ...resources, kv: [] });
        await assert.rejects(runtime.withResource('kv', 'kv-one', namespace => namespace.get('preserved')),
            error => error.statusCode === 404);
    } finally {
        await runtime.dispose();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('legacy JSON KV data is imported once without overwriting canonical values', async () => {
    const { root, runtime, resources } = fixture();
    try {
        fs.mkdirSync(path.join(root, 'legacy-kv'), { recursive: true });
        fs.writeFileSync(path.join(root, 'legacy-kv', 'kv-one.json'), JSON.stringify({ text: 'hello', json: { ok: true } }));
        await runtime.start(resources);
        assert.equal(await runtime.withResource('kv', 'kv-one', namespace => namespace.get('text')), 'hello');
        const imported = await runtime.withResource('kv', 'kv-one', namespace => namespace.getWithMetadata('json', 'json'));
        assert.deepEqual(imported.value, { ok: true });
        assert.equal(imported.metadata.ccfwpEncoding, 'json');
    } finally {
        await runtime.dispose();
        fs.rmSync(root, { recursive: true, force: true });
    }
});


test('legacy KV import is retried after a failed pass', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-resource-runtime-retry-'));
    const runtime = new ResourceRuntime({
        wranglerPersistDir: path.join(root, 'shared'),
        r2PersistDir: path.join(root, 'r2'),
        kvDataDir: path.join(root, 'legacy-kv'),
        logger: { error() {} }
    });
    const resources = {
        kv: [{ id: 'kv-one', name: 'one' }],
        d1: [],
        r2: []
    };
    try {
        fs.mkdirSync(path.join(root, 'legacy-kv'), { recursive: true });
        fs.writeFileSync(path.join(root, 'legacy-kv', 'kv-one.json'), '{not-json');
        await runtime.start(resources);
        assert.equal(runtime.legacyKVImported, false);

        fs.writeFileSync(path.join(root, 'legacy-kv', 'kv-one.json'), JSON.stringify({ recovered: 'yes' }));
        await runtime.sync(resources);
        assert.equal(runtime.legacyKVImported, true);
        assert.equal(await runtime.withResource('kv', 'kv-one', namespace => namespace.get('recovered')), 'yes');
    } finally {
        await runtime.dispose();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
