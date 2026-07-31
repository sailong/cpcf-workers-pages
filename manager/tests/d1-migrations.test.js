'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ResourceRuntime } = require('../services/resource-runtime');
const {
    createD1MigrationService,
    compareMigrationPaths,
    normalizeMigrations
} = require('../services/d1-migration-service');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-d1-migrations-'));
    const database = { id: 'database-one', name: 'database-one' };
    const runtime = new ResourceRuntime({
        wranglerPersistDir: path.join(root, 'shared'),
        r2PersistDir: path.join(root, 'r2'),
        kvDataDir: path.join(root, 'legacy-kv'),
        logger: { error() {} }
    });
    const service = createD1MigrationService({
        resourceRuntime: runtime,
        resourceService: { getD1: () => [database] }
    });
    return { root, database, runtime, service };
}

test('D1 migrations use Wrangler-compatible path ordering and reject unsafe input', () => {
    const names = ['10_last.sql', '2_second.sql', 'alpha.sql', '1_first.sql', '3/nested.sql'];
    assert.deepEqual([...names].sort(compareMigrationPaths), [
        '1_first.sql', '2_second.sql', '3/nested.sql', '10_last.sql', 'alpha.sql'
    ]);
    assert.throws(() => normalizeMigrations([{ name: '../escape.sql', sql: 'SELECT 1' }]), /Invalid migration name/);
    assert.throws(() => normalizeMigrations([{ name: '1.sql', sql: 'SELECT 1' }, { name: '1.sql', sql: 'SELECT 2' }]), /Duplicate/);
});

test('D1 migrations apply in order and are idempotent', async () => {
    const { root, database, runtime, service } = fixture();
    try {
        await runtime.start({ kv: [], d1: [database], r2: [] });
        const input = [
            { name: '2_add_name.sql', sql: 'ALTER TABLE entries ADD COLUMN name TEXT;' },
            { name: '1_create_entries.sql', sql: 'CREATE TABLE entries (id INTEGER PRIMARY KEY);' }
        ];
        const first = await service.apply(database.id, input);
        assert.deepEqual(first.applied, ['1_create_entries.sql', '2_add_name.sql']);
        assert.deepEqual(first.skipped, []);
        assert.deepEqual(first.migrations.map(item => item.name), first.applied);

        const second = await service.apply(database.id, input);
        assert.deepEqual(second.applied, []);
        assert.deepEqual(second.skipped, ['1_create_entries.sql', '2_add_name.sql']);

        const columns = await runtime.withResource('d1', database.id,
            db => db.prepare('PRAGMA table_info(entries)').all());
        assert.deepEqual(columns.results.map(column => column.name), ['id', 'name']);
    } finally {
        await runtime.dispose();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('failed and concurrent D1 migrations never record unapplied work twice', async () => {
    const { root, database, runtime, service } = fixture();
    try {
        await runtime.start({ kv: [], d1: [database], r2: [] });
        await assert.rejects(service.apply(database.id, [
            { name: '1_invalid.sql', sql: 'CREATE TABLE broken (' }
        ]), error => error.statusCode === 422 && error.migrationName === '1_invalid.sql');
        assert.deepEqual((await service.list(database.id)).applied, []);

        const migration = [{ name: '2_concurrent.sql', sql: 'CREATE TABLE concurrent_entries (id INTEGER PRIMARY KEY);' }];
        const [left, right] = await Promise.all([
            service.apply(database.id, migration),
            service.apply(database.id, migration)
        ]);
        assert.equal(left.applied.length + right.applied.length, 1);
        assert.equal(left.skipped.length + right.skipped.length, 1);
        assert.deepEqual((await service.list(database.id)).applied.map(item => item.name), ['2_concurrent.sql']);
    } finally {
        await runtime.dispose();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
