'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../services/database');
const { createProjectService } = require('../services/project-service');
const { createRuntimeLogService } = require('../services/runtime-log-service');

function fixture(options = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-runtime-logs-'));
    const db = createDatabase({
        databaseFile: path.join(root, 'control-plane.sqlite3'),
        projectsFile: path.join(root, 'missing-projects.json'),
        resourcesFile: path.join(root, 'missing-resources.json')
    });
    createProjectService({ db }).add({
        id: 'project-1', name: 'demo', type: 'worker', port: 10001, status: 'stopped',
        mainFile: null, bindings: {}, envVars: {}, createdAt: '2026-01-01T00:00:00.000Z'
    });
    return {
        db,
        logs: createRuntimeLogService({ db, ...options }),
        cleanup() {
            db.close();
            fs.rmSync(root, { recursive: true, force: true });
        }
    };
}

test('runtime logs are sanitized, split, and bounded by project', () => {
    const f = fixture({ maxEntries: 2, retentionMs: 60_000, now: () => new Date('2026-01-01T00:00:00.000Z') });
    try {
        f.logs.append('project-1', 'stdout', '\u001b[32mfirst\u001b[0m\nsecond\u0000');
        f.logs.append('project-1', 'stderr', 'third');
        const logs = f.logs.list('project-1');
        assert.deepEqual(logs.map(item => item.content), ['second', 'third']);
        assert.deepEqual(logs.map(item => item.stream), ['stdout', 'stderr']);
        assert.equal(f.logs.clear('project-1'), 2);
        assert.deepEqual(f.logs.list('project-1'), []);
    } finally {
        f.cleanup();
    }
});

test('runtime log retention removes expired entries', () => {
    let current = new Date('2026-01-01T00:00:00.000Z');
    const f = fixture({ maxEntries: 10, retentionMs: 60_000, now: () => current });
    try {
        f.logs.append('project-1', 'system', 'old');
        current = new Date('2026-01-01T00:02:00.000Z');
        f.logs.append('project-1', 'system', 'fresh');
        assert.deepEqual(f.logs.list('project-1').map(item => item.content), ['fresh']);
    } finally {
        f.cleanup();
    }
});
