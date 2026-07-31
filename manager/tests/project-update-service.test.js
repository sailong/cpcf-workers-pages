'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyProjectUpdate } = require('../services/project-update-service');

function fixture(overrides = {}) {
    let stored = {
        id: 'worker-one',
        status: 'running',
        port: 10001,
        limits: { cpu: 0.5, memoryMb: 512 },
        ...overrides.project
    };
    const calls = [];
    const projectService = {
        update(id, changes) {
            calls.push(['update', id, structuredClone(changes)]);
            stored = { ...stored, ...structuredClone(changes) };
            return structuredClone(stored);
        }
    };
    return {
        calls,
        project: structuredClone(stored),
        projectService,
        current: () => structuredClone(stored)
    };
}

test('running project limit updates restart with the persisted configuration', async () => {
    const f = fixture();
    const runtime = {
        stop: async id => f.calls.push(['stop', id]),
        start: async project => f.calls.push(['start', structuredClone(project)])
    };

    const result = await applyProjectUpdate(f.project, {
        limits: { cpu: 1, memoryMb: 1024 }
    }, { projectService: f.projectService, runtime, needsRestart: true });

    assert.equal(result.restarted, true);
    assert.deepEqual(f.current().limits, { cpu: 1, memoryMb: 1024 });
    assert.deepEqual(f.calls.map(call => call[0]), ['update', 'stop', 'start']);
    assert.deepEqual(f.calls[2][1].limits, { cpu: 1, memoryMb: 1024 });
});

test('failed restart restores the previous configuration and running state', async () => {
    const f = fixture();
    let starts = 0;
    const runtime = {
        stop: async id => f.calls.push(['stop', id]),
        start: async project => {
            starts += 1;
            f.calls.push(['start', structuredClone(project)]);
            if (starts === 1) throw new Error('container rejected limits');
        }
    };

    await assert.rejects(
        applyProjectUpdate(f.project, {
            port: 11000,
            limits: { cpu: 2, memoryMb: 2048 }
        }, { projectService: f.projectService, runtime, needsRestart: true }),
        error => error.updateReverted === true && /rejected limits/.test(error.message)
    );

    assert.equal(f.current().port, 10001);
    assert.deepEqual(f.current().limits, { cpu: 0.5, memoryMb: 512 });
    assert.equal(f.current().status, 'running');
    assert.deepEqual(f.calls.filter(call => call[0] === 'start').map(call => call[1].port), [11000, 10001]);
});

test('failed rollback restart leaves the project stopped', async () => {
    const f = fixture();
    const runtime = {
        stop: async () => {},
        start: async () => { throw new Error('runtime unavailable'); }
    };

    await assert.rejects(
        applyProjectUpdate(f.project, { port: 11000 }, {
            projectService: f.projectService,
            runtime,
            needsRestart: true
        }),
        error => error.updateReverted === false && error.rollbackError instanceof Error
    );

    assert.equal(f.current().port, 10001);
    assert.equal(f.current().status, 'stopped');
});
