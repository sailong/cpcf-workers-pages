'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { restoreResource } = require('../services/resource-restore-service');

function restoredResource() {
    return {
        id: 'kv-one',
        kind: 'kv',
        name: 'cache',
        created: '2026-01-01T00:00:00.000Z',
        deletedAt: '2026-02-01T00:00:00.000Z',
        purgeAfter: '2026-03-03T00:00:00.000Z',
        restoreAuditId: 'audit-one'
    };
}

test('resource restore returns only active resource fields after runtime synchronization', async () => {
    const resourceService = {
        restore: () => restoredResource(),
        rollbackRestore: () => { throw new Error('unexpected rollback'); }
    };
    const runtimeService = { updateResources: async () => {} };

    assert.deepEqual(await restoreResource('kv-one', { resourceService, runtimeService }), {
        id: 'kv-one', kind: 'kv', name: 'cache', created: '2026-01-01T00:00:00.000Z'
    });
});

test('runtime synchronization failure restores trash metadata and retries runtime sync', async () => {
    const restored = restoredResource();
    const calls = [];
    const resourceService = {
        restore: () => restored,
        rollbackRestore: value => { calls.push(['rollback', value]); return true; }
    };
    let syncCount = 0;
    const runtimeService = {
        updateResources: async () => {
            syncCount += 1;
            if (syncCount === 1) throw new Error('runtime sync unavailable');
        }
    };

    await assert.rejects(
        restoreResource('kv-one', { resourceService, runtimeService }),
        error => error.restoreReverted === true && /sync unavailable/.test(error.message)
    );
    assert.equal(syncCount, 2);
    assert.deepEqual(calls, [['rollback', restored]]);
});

test('resource restore exposes rollback synchronization failure for diagnostics', async () => {
    const resourceService = {
        restore: () => restoredResource(),
        rollbackRestore: () => true
    };
    const runtimeService = { updateResources: async () => { throw new Error('sync unavailable'); } };

    await assert.rejects(
        restoreResource('kv-one', { resourceService, runtimeService }),
        error => error.restoreReverted === true && /sync unavailable/.test(error.rollbackSyncError.message)
    );
});
