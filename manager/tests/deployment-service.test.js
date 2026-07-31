'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../services/database');
const { createProjectService } = require('../services/project-service');
const { createDeploymentService } = require('../services/deployment-service');

function fixture(options = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-deployment-'));
    const db = createDatabase({
        databaseFile: path.join(root, 'control-plane.sqlite3'),
        projectsFile: path.join(root, 'missing-projects.json'),
        resourcesFile: path.join(root, 'missing-resources.json')
    });
    const projects = createProjectService({ db });
    projects.add({
        id: 'project-1', name: 'demo', type: 'worker', port: 10001, status: 'stopped',
        mainFile: null, bindings: {}, envVars: {}, createdAt: '2026-01-01T00:00:00.000Z'
    });
    projects.add({
        id: 'project-2', name: 'other', type: 'pages', port: 10002, status: 'stopped',
        mainFile: null, bindings: {}, envVars: {}, createdAt: '2026-01-01T00:00:00.000Z'
    });
    let time = 0;
    const deployments = createDeploymentService({
        db,
        now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, time++)),
        ...options
    });
    return {
        db,
        deployments,
        cleanup() {
            db.close();
            fs.rmSync(root, { recursive: true, force: true });
        }
    };
}

test('deployment recorder persists logs and terminal status per project', () => {
    const f = fixture();
    try {
        const recorder = f.deployments.createRecorder('project-1', 'rebuild', { command: 'npm run build' });
        recorder.onEvent('log', { content: 'building' });
        recorder.onEvent('result', { success: true, releaseId: 'release-1' });
        recorder.interrupt();

        const stored = f.deployments.get('project-1', recorder.deployment.id);
        assert.equal(stored.status, 'succeeded');
        assert.equal(stored.kind, 'rebuild');
        assert.deepEqual(stored.metadata, { command: 'npm run build' });
        assert.equal(stored.logs[0].content, 'building');
        assert.deepEqual(stored.result, { success: true, releaseId: 'release-1' });
        assert.equal(f.deployments.get('project-2', recorder.deployment.id), null);
        assert.deepEqual(f.deployments.list('project-1').map(item => item.id), [recorder.deployment.id]);
        assert.deepEqual(f.deployments.listAll().map(item => ({
            id: item.id,
            projectName: item.projectName,
            projectType: item.projectType
        })), [{ id: recorder.deployment.id, projectName: 'demo', projectType: 'worker' }]);
    } finally {
        f.cleanup();
    }
});

test('failed recorder stores the error and ignores later result events', () => {
    const f = fixture();
    try {
        const recorder = f.deployments.createRecorder('project-1', 'deploy');
        recorder.onEvent('error', { content: 'build failed' });
        recorder.onEvent('result', { success: true });
        const stored = f.deployments.get('project-1', recorder.deployment.id);
        assert.equal(stored.status, 'failed');
        assert.equal(stored.logs[0].level, 'error');
        assert.deepEqual(stored.result, { error: 'build failed' });
    } finally {
        f.cleanup();
    }
});

test('deployment logs are bounded by entry and total-size limits', () => {
    const f = fixture({ maxLogEntries: 2, maxLogEntryBytes: 5, maxLogBytes: 8 });
    try {
        const deployment = f.deployments.start('project-1', 'rebuild');
        f.deployments.append(deployment.id, 'info', '123456789');
        f.deployments.append(deployment.id, 'info', 'abcdef');
        f.deployments.append(deployment.id, 'info', 'ignored');
        const stored = f.deployments.get('project-1', deployment.id);
        assert.deepEqual(stored.logs.map(item => item.content), ['12345', 'abc']);
        const payload = JSON.parse(f.db.prepare('SELECT payload FROM operations WHERE id = ?').get(deployment.id).payload);
        assert.equal(payload.logBytes, 8);
        assert.equal(payload.truncated, true);
    } finally {
        f.cleanup();
    }
});

test('completed operations are retained by count while running work is protected', () => {
    const f = fixture({ maxOperations: 2, retentionMs: 365 * 24 * 60 * 60 * 1000 });
    try {
        const running = f.deployments.start('project-1', 'rebuild');
        const completed = [];
        for (let index = 0; index < 4; index += 1) {
            const operation = f.deployments.start('project-1', 'deploy', { index });
            f.deployments.finish(operation.id, 'succeeded', { index });
            completed.push(operation.id);
        }

        const rows = f.db.prepare('SELECT id, status FROM operations WHERE project_id = ? ORDER BY created_at DESC').all('project-1');
        assert.equal(rows.filter(row => row.status !== 'running').length, 2);
        assert.equal(rows.some(row => row.id === running.id && row.status === 'running'), true);
        assert.equal(rows.some(row => row.id === completed[0]), false);
    } finally {
        f.cleanup();
    }
});

test('old operations expire and unfinished work is recovered after restart', () => {
    let current = new Date('2026-01-01T00:00:00.000Z');
    const f = fixture({ now: () => current, maxOperations: 10, retentionMs: 60_000 });
    try {
        const old = f.deployments.start('project-1', 'deploy');
        f.deployments.finish(old.id, 'failed', { error: 'old' });
        const interrupted = f.deployments.start('project-1', 'rebuild');
        current = new Date('2026-01-01T00:02:00.000Z');

        assert.equal(f.deployments.recoverInterrupted(), 1);
        f.deployments.pruneAll();
        assert.equal(f.deployments.get('project-1', old.id), null);
        assert.equal(f.deployments.get('project-1', interrupted.id).status, 'interrupted');
    } finally {
        f.cleanup();
    }
});
