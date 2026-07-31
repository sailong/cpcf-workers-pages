'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../services/database');
const { createProjectService } = require('../services/project-service');
const {
    DEFAULT_COMPATIBILITY_DATE,
    DEFAULT_COMPATIBILITY_FLAGS,
    normalizeProjectCompatibility
} = require('../services/project-compatibility');
const { generateConfig } = require('../utils/generator');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-compatibility-'));
    const db = createDatabase({
        databaseFile: path.join(root, 'control-plane.sqlite3'),
        projectsFile: path.join(root, 'missing-projects.json'),
        resourcesFile: path.join(root, 'missing-resources.json')
    });
    return { root, db, projects: createProjectService({ db }) };
}

test('compatibility settings default, validate, and render into Wrangler configuration', () => {
    assert.deepEqual(normalizeProjectCompatibility({}), {
        compatibilityDate: DEFAULT_COMPATIBILITY_DATE,
        compatibilityFlags: [...DEFAULT_COMPATIBILITY_FLAGS]
    });
    assert.throws(() => normalizeProjectCompatibility({ compatibilityDate: '2025-02-30' }), /valid calendar date/);
    assert.throws(() => normalizeProjectCompatibility({ compatibilityFlags: ['nodejs_compat', 'nodejs_compat'] }), /Duplicate/);
    assert.throws(() => normalizeProjectCompatibility({ compatibilityFlags: ['INVALID-FLAG'] }), /lowercase/);

    const config = generateConfig({
        id: 'project-1', name: 'demo', type: 'worker', mainFile: 'worker.js', port: 10000,
        compatibilityDate: '2025-01-15', compatibilityFlags: ['nodejs_compat', 'streams_enable_constructors']
    });
    assert.match(config, /compatibility_date = "2025-01-15"/);
    assert.match(config, /compatibility_flags = \["nodejs_compat", "streams_enable_constructors"\]/);
});

test('project compatibility settings persist and legacy payloads hydrate with defaults', () => {
    const f = fixture();
    try {
        f.projects.add({
            id: 'project-1', name: 'demo', type: 'worker', port: 10000, status: 'stopped',
            mainFile: 'worker.js', bindings: {}, envVars: {}, createdAt: new Date().toISOString()
        });
        assert.equal(f.projects.getById('project-1').compatibilityDate, DEFAULT_COMPATIBILITY_DATE);
        assert.deepEqual(f.projects.getById('project-1').compatibilityFlags, [...DEFAULT_COMPATIBILITY_FLAGS]);

        const updated = f.projects.update('project-1', {
            compatibilityDate: '2025-01-15',
            compatibilityFlags: []
        });
        assert.equal(updated.compatibilityDate, '2025-01-15');
        assert.deepEqual(updated.compatibilityFlags, []);
    } finally {
        f.db.close();
        fs.rmSync(f.root, { recursive: true, force: true });
    }
});
