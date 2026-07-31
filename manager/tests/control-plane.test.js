'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createDatabase, SCHEMA_VERSION } = require('../services/database');
const { createProjectService } = require('../services/project-service');
const { createResourceService } = require('../services/resource-service');
const { createResourceStorageService } = require('../services/resource-storage-service');
const { reconcileResourceDeletion } = require('../services/runtime-resource-reconciler');
const { startResourceCleanupScheduler } = require('../services/resource-cleanup-scheduler');

function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-control-plane-'));
    return {
        root,
        databaseFile: path.join(root, 'control-plane.sqlite3'),
        projectsFile: path.join(root, 'projects.json'),
        resourcesFile: path.join(root, 'resources.json'),
        cleanup() {
            fs.rmSync(root, { recursive: true, force: true });
        }
    };
}

function writeLegacy(fixture, projects = [], resources = { kv: [], d1: [], r2: [] }) {
    fs.writeFileSync(fixture.projectsFile, JSON.stringify(projects));
    fs.writeFileSync(fixture.resourcesFile, JSON.stringify(resources));
}

test('empty installation creates a repeatable WAL database without touching real platform data', () => {
    const fixture = createFixture();
    try {
        let db = createDatabase(fixture);
        assert.equal(db.pragma('user_version', { simple: true }), SCHEMA_VERSION);
        assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
        assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 0);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'releases'").get().count, 1);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'operations'").get().count, 1);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'runtime_logs'").get().count, 1);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'projects_port_unique_idx'").get().count, 1);
        db.close();

        db = createDatabase(fixture);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM settings WHERE key = 'legacy_json_import_v1'").get().count, 1);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('project ports are unique at the control-plane commit boundary', () => {
    const fixture = createFixture();
    try {
        const db = createDatabase(fixture);
        const projects = createProjectService({ db });
        const base = { type: 'worker', status: 'stopped', port: 12001, bindings: { kv: [], d1: [], r2: [] } };
        projects.add({ ...base, id: 'project-one', name: 'one' });
        assert.throws(
            () => projects.add({ ...base, id: 'project-two', name: 'two' }),
            error => error.statusCode === 409 && /12001/.test(error.message)
        );
        assert.equal(projects.getAll().length, 1);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('schema v3 separates persisted operations from release activation history', () => {
    const fixture = createFixture();
    try {
        let db = createDatabase(fixture);
        const createdAt = '2026-01-01T00:00:00.000Z';
        db.prepare('INSERT INTO projects (id, name, type, status, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run('project-1', 'demo', 'worker', 'stopped', '{}', createdAt);
        db.prepare('INSERT INTO deployments (id, project_id, status, payload, created_at) VALUES (?, ?, ?, ?, ?)')
            .run('activation-1', 'project-1', 'activated', '{"releaseId":"release-1"}', createdAt);
        db.prepare('INSERT INTO deployments (id, project_id, status, payload, created_at) VALUES (?, ?, ?, ?, ?)')
            .run('deployment-operation-1', 'project-1', 'succeeded', '{"kind":"rebuild","logs":[]}', createdAt);
        db.exec('DROP TABLE runtime_logs; DROP TABLE operations; PRAGMA user_version = 2;');
        db.close();

        db = createDatabase(fixture);
        assert.equal(db.pragma('user_version', { simple: true }), SCHEMA_VERSION);
        assert.deepEqual(db.prepare('SELECT id FROM deployments ORDER BY id').all(), [{ id: 'activation-1' }]);
        assert.deepEqual(db.prepare('SELECT id FROM operations ORDER BY id').all(), [{ id: 'deployment-operation-1' }]);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('legacy import preserves projects, resources, bindings, and immutable source backups', () => {
    const fixture = createFixture();
    const project = {
        id: 'project-1', name: 'demo', type: 'worker', status: 'stopped', createdAt: '2026-01-01T00:00:00.000Z',
        bindings: { kv: [{ varName: 'CACHE', resourceId: 'kv-1' }], d1: [], r2: [] }
    };
    try {
        writeLegacy(fixture, [project], { kv: [{ id: 'kv-1', name: 'cache', created: '2026-01-01T00:00:00.000Z' }], d1: [], r2: [] });
        const db = createDatabase(fixture);
        const projects = createProjectService({ db });
        assert.deepEqual(projects.getById('project-1').bindings.kv, [{ varName: 'CACHE', resourceId: 'kv-1' }]);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM resources').get().count, 1);
        assert.equal(fs.statSync(`${fixture.projectsFile}.pre-sqlite-backup`).mode & 0o777, 0o444);
        assert.equal(fs.statSync(`${fixture.resourcesFile}.pre-sqlite-backup`).mode & 0o777, 0o444);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('corrupt legacy JSON fails closed and can be corrected on repeat startup', () => {
    const fixture = createFixture();
    try {
        fs.writeFileSync(fixture.projectsFile, '{broken');
        fs.writeFileSync(fixture.resourcesFile, JSON.stringify({ kv: [], d1: [], r2: [] }));
        assert.throws(() => createDatabase(fixture), /JSON|position|property/i);
        assert.equal(fs.existsSync(`${fixture.projectsFile}.pre-sqlite-backup`), false);

        writeLegacy(fixture);
        const db = createDatabase(fixture);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM settings WHERE key = 'legacy_json_import_v1'").get().count, 1);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('interrupted legacy import rolls back atomically and succeeds on retry', () => {
    const fixture = createFixture();
    try {
        let db = createDatabase(fixture);
        db.prepare("DELETE FROM settings WHERE key = 'legacy_json_import_v1'").run();
        db.exec("CREATE TRIGGER interrupt_resource_import BEFORE INSERT ON resources BEGIN SELECT RAISE(ABORT, 'simulated interruption'); END");
        db.close();

        writeLegacy(fixture,
            [{ id: 'project-1', name: 'demo', type: 'worker', bindings: { kv: [], d1: [], r2: [] } }],
            { kv: [{ id: 'kv-1', name: 'cache' }], d1: [], r2: [] }
        );
        assert.throws(() => createDatabase(fixture), /simulated interruption/);

        db = new Database(fixture.databaseFile);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 0);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM resources').get().count, 0);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM settings WHERE key = 'legacy_json_import_v1'").get().count, 0);
        db.exec('DROP TRIGGER interrupt_resource_import');
        db.close();

        db = createDatabase(fixture);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 1);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM resources').get().count, 1);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('trash deletion is atomic, reserves names, restores without bindings, and purge releases names', async () => {
    const fixture = createFixture();
    const project = {
        id: 'project-1', name: 'demo', type: 'worker', status: 'stopped',
        bindings: { kv: [{ varName: 'CACHE', resourceId: 'kv-1' }], d1: [], r2: [] }
    };
    try {
        writeLegacy(fixture, [project], { kv: [{ id: 'kv-1', name: 'cache' }], d1: [], r2: [] });
        const db = createDatabase(fixture);
        const projects = createProjectService({ db });
        const purgedStorage = [];
        const storage = { purge: async resource => purgedStorage.push(`${resource.kind}:${resource.id}`) };
        const resources = createResourceService({ db, storage, now: () => new Date('2026-02-01T00:00:00.000Z') });

        db.exec("CREATE TRIGGER interrupt_trash_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'audit interruption'); END");
        assert.throws(() => resources.softDelete('kv', 'kv-1'), /audit interruption/);
        assert.equal(resources.getKV().length, 1);
        assert.equal(projects.getById('project-1').bindings.kv.length, 1);
        db.exec('DROP TRIGGER interrupt_trash_audit');

        const deleted = resources.softDelete('kv', 'kv-1');
        assert.deepEqual(deleted.affectedProjectIds, ['project-1']);
        assert.equal(deleted.purgeAfter, '2026-03-03T00:00:00.000Z');
        assert.equal(resources.getKV().length, 0);
        assert.equal(projects.getById('project-1').bindings.kv.length, 0);
        assert.throws(() => resources.create('kv', 'cache'), error => error.statusCode === 409 && /reserved/i.test(error.publicMessage));

        assert.ok(resources.restore('kv-1'));
        assert.equal(projects.getById('project-1').bindings.kv.length, 0);
        const restoredForRollback = resources.softDelete('kv', 'kv-1');
        const restored = resources.restore('kv-1');
        assert.equal(resources.rollbackRestore(restored), true);
        assert.equal(resources.listTrash()[0].deletedAt, restoredForRollback.deletedAt);
        assert.equal(resources.listTrash()[0].purgeAfter, restoredForRollback.purgeAfter);
        assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'resource.restore'").get().count, 1);
        resources.restore('kv-1');
        resources.softDelete('kv', 'kv-1');
        assert.equal(await resources.purge('kv-1'), null);

        const expiredResources = createResourceService({ db, storage, now: () => new Date('2026-04-01T00:00:00.000Z') });
        assert.ok(await expiredResources.purge('kv-1'));
        assert.deepEqual(purgedStorage, ['kv:kv-1']);
        assert.equal(expiredResources.create('kv', 'cache').name, 'cache');
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM audit_events').get().count, 6);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('physical purge failure keeps trash metadata and reserved name for retry', async () => {
    const fixture = createFixture();
    try {
        writeLegacy(fixture, [], { kv: [{ id: 'kv-1', name: 'cache' }], d1: [], r2: [] });
        const db = createDatabase(fixture);
        const resources = createResourceService({
            db,
            now: () => new Date('2026-04-01T00:00:00.000Z'),
            storage: { purge: async () => { throw new Error('storage unavailable'); } }
        });
        resources.softDelete('kv', 'kv-1');
        await assert.rejects(resources.purge('kv-1', 'system', true), /storage unavailable/);
        assert.equal(resources.listTrash().length, 1);
        assert.throws(() => resources.create('kv', 'cache'), error => error.statusCode === 409);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('project bindings reject missing, trashed, mismatched, and duplicate resources', () => {
    const fixture = createFixture();
    try {
        writeLegacy(fixture, [], {
            kv: [{ id: 'kv-one', name: 'cache' }],
            d1: [{ id: 'd1-one', name: 'database' }],
            r2: []
        });
        const db = createDatabase(fixture);
        const resources = createResourceService({ db });
        const projects = createProjectService({ db });
        const base = {
            id: 'project-one', name: 'one', type: 'worker', status: 'stopped',
            bindings: { kv: [], d1: [], r2: [] }
        };
        assert.throws(() => projects.add({ ...base, bindings: {
            kv: [{ varName: 'CACHE', resourceId: 'd1-one' }], d1: [], r2: []
        } }), /mismatched resource/);
        assert.throws(() => projects.add({ ...base, bindings: {
            kv: [{ varName: 'CACHE', resourceId: 'missing' }], d1: [], r2: []
        } }), /unavailable/);
        assert.throws(() => projects.add({ ...base, bindings: {
            kv: [{ varName: 'DATA', resourceId: 'kv-one' }],
            d1: [{ varName: 'DATA', resourceId: 'd1-one' }], r2: []
        } }), /Duplicate binding name/);
        resources.softDelete('kv', 'kv-one');
        assert.throws(() => projects.add({ ...base, bindings: {
            kv: [{ varName: 'CACHE', resourceId: 'kv-one' }], d1: [], r2: []
        } }), /unavailable/);
        assert.equal(projects.getAll().length, 0);
        assert.throws(() => resources.create('r2', 'Invalid_Bucket'), error => error.statusCode === 400);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('project routing names are unique without case-sensitive collisions', () => {
    const fixture = createFixture();
    try {
        const db = createDatabase(fixture);
        const projects = createProjectService({ db });
        const base = { type: 'worker', status: 'stopped', bindings: { kv: [], d1: [], r2: [] } };
        projects.add({ ...base, id: 'project-demo', name: 'Demo' });
        assert.throws(
            () => projects.add({ ...base, id: 'project-demo-lower', name: 'demo' }),
            error => error.statusCode === 409
        );
        projects.add({ ...base, id: 'project-demo-pages', name: 'demo', type: 'pages' });
        assert.equal(projects.getAll().length, 2);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('failed resource runtime synchronization can roll back an unbound create', () => {
    const fixture = createFixture();
    try {
        const db = createDatabase(fixture);
        const resources = createResourceService({ db });
        const created = resources.create('kv', 'temporary');
        assert.equal(resources.rollbackCreate('kv', created.id), true);
        assert.equal(resources.getKV().length, 0);
        assert.equal(resources.rollbackCreate('kv', created.id), false);
        db.close();
    } finally {
        fixture.cleanup();
    }
});

test('storage cleanup scopes KV and R2 work to isolated resource roots', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-resource-storage-'));
    const kvDataDir = path.join(root, 'kv-data');
    const shared = path.join(root, 'shared');
    const r2 = path.join(root, 'r2');
    const calls = [];
    try {
        fs.mkdirSync(kvDataDir, { recursive: true });
        fs.mkdirSync(shared, { recursive: true });
        fs.mkdirSync(r2, { recursive: true });
        fs.writeFileSync(path.join(kvDataDir, 'kv-one.json'), '{"a":"b"}');
        fs.writeFileSync(path.join(kvDataDir, 'kv-other.json'), '{"keep":true}');
        const storage = createResourceStorageService({
            dataDir: root,
            kvDataDir,
            wranglerStateDir: shared,
            r2StateDir: r2,
            resourceRuntime: { suspendResource: async (resource, cleanup) => cleanup() },
            runWranglerCleanup: async (resource, kind, stateDir) => calls.push([resource.id, kind, stateDir])
        });

        await storage.purge({ id: 'kv-one', kind: 'kv', name: 'one' });
        assert.equal(fs.existsSync(path.join(kvDataDir, 'kv-one.json')), false);
        assert.equal(fs.existsSync(path.join(kvDataDir, 'kv-other.json')), true);
        await storage.purge({ id: 'r2-one', kind: 'r2', name: 'one' });
        assert.deepEqual(calls, [
            ['kv-one', 'kv', shared],
            ['r2-one', 'r2', shared],
            ['r2-one', 'r2', r2]
        ]);
        await assert.rejects(storage.purge({ id: '../escape', kind: 'kv', name: 'bad' }), /invalid resource ID/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('resource revocation restarts running projects with current bindings and stops on restart failure', async () => {
    const projects = new Map([
        ['running-ok', { id: 'running-ok', status: 'running', bindings: { kv: [], d1: [], r2: [] } }],
        ['running-fail', { id: 'running-fail', status: 'running', bindings: { kv: [], d1: [], r2: [] } }]
    ]);
    const stopped = [];
    const started = [];
    const statusUpdates = [];
    const result = await reconcileResourceDeletion({
        kind: 'kv', affectedProjectIds: ['running-ok', 'running-fail']
    }, {
        runtime: {
            isRunning: () => true,
            stop: id => stopped.push(id),
            start: async project => {
                started.push(project);
                if (project.id === 'running-fail') throw new Error('restart failed');
            }
        },
        projectService: {
            getById: id => projects.get(id),
            update: (id, changes) => statusUpdates.push([id, changes])
        },
        updateResources: () => {},
        logger: { error() {} }
    });

    assert.deepEqual(stopped, ['running-ok', 'running-fail']);
    assert.equal(started.every(project => project.bindings.kv.length === 0), true);
    assert.deepEqual(statusUpdates, [['running-fail', { status: 'stopped' }]]);
    assert.equal(result.failures.length, 1);
});

test('cleanup scheduler runs immediately and contains scheduled asynchronous failures', async () => {
    let scheduledCallback;
    let calls = 0;
    const errors = [];
    const timer = { unrefCalled: false, unref() { this.unrefCalled = true; } };
    const scheduler = startResourceCleanupScheduler({
        resourceService: {
            purgeExpired: async () => {
                calls++;
                if (calls === 1) return [];
                throw new Error('cleanup failed');
            },
            getAll: () => ({ kv: [], d1: [], r2: [] })
        },
        runtimeService: { updateResources() {} },
        setIntervalFn: callback => {
            scheduledCallback = callback;
            return timer;
        },
        logger: { error: (...args) => errors.push(args) }
    });

    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    assert.equal(timer.unrefCalled, true);
    scheduledCallback();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2);
    assert.match(errors[0][0], /Scheduled purge failed/);
    assert.equal(scheduler.timer, timer);
});
