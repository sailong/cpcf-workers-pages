'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ProjectOperationCoordinator } = require('../services/project-operation-coordinator');

test('conflicting operations on one project fail fast with the active operation', async () => {
    const coordinator = new ProjectOperationCoordinator();
    let release;
    const first = coordinator.run('project-one', 'rebuild', () => new Promise(resolve => { release = resolve; }));
    await Promise.resolve();

    await assert.rejects(
        coordinator.run('project-one', 'delete', async () => {}),
        error => error.statusCode === 409 && error.activeOperation === 'rebuild'
    );
    assert.equal(coordinator.get('project-one').kind, 'rebuild');
    release('done');
    assert.equal(await first, 'done');
    assert.equal(coordinator.get('project-one'), null);
});

test('operations on different projects run independently and locks release after failure', async () => {
    const coordinator = new ProjectOperationCoordinator();
    const values = await Promise.all([
        coordinator.run('project-one', 'start', async () => 'one'),
        coordinator.run('project-two', 'start', async () => 'two')
    ]);
    assert.deepEqual(values, ['one', 'two']);

    await assert.rejects(coordinator.run('project-one', 'deploy', async () => {
        throw new Error('failed');
    }), /failed/);
    assert.equal(await coordinator.run('project-one', 'rollback', async () => 'recovered'), 'recovered');
});
