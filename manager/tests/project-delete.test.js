'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeleteProjectHandler } = require('../routes/projects');

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function fixture(options = {}) {
    const project = {
        id: 'project-one',
        name: 'project-one',
        type: 'worker',
        status: 'running',
        mainFile: 'worker-one.js'
    };
    const calls = [];
    const projects = {
        getById: id => id === project.id ? project : null,
        update: (id, changes) => { calls.push(['update', id, changes]); Object.assign(project, changes); return project; },
        remove: id => calls.push(['remove', id])
    };
    const handler = createDeleteProjectHandler({
        projectService: projects,
        runtime: { stop: async id => calls.push(['stop', id]) },
        fs: {
            existsSync: () => true,
            rmSync: options.rmSync || ((target, config) => calls.push(['rm', target, config]))
        },
        config: { UPLOADS_DIR: '/uploads', PROJECTS_DIR: '/projects' },
        resolveWithin: (root, target) => `${root}/${target}`,
        isReleasePath: () => false,
        auditService: { record: (...args) => calls.push(['audit', ...args]) }
    });
    return { calls, handler, project };
}

test('project cleanup failure retains a stopped project for retry', async () => {
    const fixtureData = fixture({ rmSync: () => { throw new Error('disk unavailable'); } });
    const res = response();
    const originalError = console.error;
    console.error = () => {};
    try {
        await fixtureData.handler({ params: { id: fixtureData.project.id } }, res);
    } finally {
        console.error = originalError;
    }

    assert.equal(res.statusCode, 500);
    assert.match(res.body.error, /retained for retry/);
    assert.equal(fixtureData.project.status, 'stopped');
    assert.deepEqual(fixtureData.calls.slice(0, 2), [
        ['stop', 'project-one'],
        ['update', 'project-one', { status: 'stopped' }]
    ]);
    assert.equal(fixtureData.calls.some(call => call[0] === 'remove'), false);
    assert.equal(fixtureData.calls.some(call => call[0] === 'audit'), false);
});

test('project deletion removes metadata only after filesystem cleanup succeeds', async () => {
    const fixtureData = fixture();
    const res = response();
    await fixtureData.handler({ params: { id: fixtureData.project.id } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(fixtureData.calls.map(call => call[0]), ['stop', 'update', 'rm', 'remove', 'audit']);
    assert.deepEqual(res.body, { message: 'Project deleted', id: 'project-one' });
});
