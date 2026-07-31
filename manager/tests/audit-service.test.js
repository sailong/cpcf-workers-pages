'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../services/database');
const { createAuditService, sanitizeDetails } = require('../services/audit-service');

test('audit detail sanitization removes secrets, SQL, request bodies, and binary objects', () => {
    const details = {
        actionName: 'apply migration',
        sql: 'CREATE TABLE private_data(value TEXT)',
        nested: {
            password: 'admin-password',
            apiToken: 'token-value',
            envVars: { DATABASE_URL: { value: 'secret-url' } },
            requestBody: { object: 'content' },
            message: 'Bearer abc.def.ghi'
        },
        bytes: Buffer.from('private object body')
    };
    const sanitized = sanitizeDetails(details);
    assert.equal(sanitized.actionName, 'apply migration');
    assert.equal(sanitized.sql, '[REDACTED]');
    assert.equal(sanitized.nested.password, '[REDACTED]');
    assert.equal(sanitized.nested.apiToken, '[REDACTED]');
    assert.equal(sanitized.nested.envVars, '[REDACTED]');
    assert.equal(sanitized.nested.requestBody, '[REDACTED]');
    assert.equal(sanitized.nested.message, '[REDACTED]');
    assert.equal(sanitized.bytes, '[BINARY]');
    assert.doesNotMatch(JSON.stringify(sanitized), /CREATE TABLE|admin-password|token-value|secret-url|private object body/);
});

test('audit records persist only sanitized bounded details', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-audit-'));
    const db = createDatabase({
        databaseFile: path.join(root, 'control-plane.sqlite3'),
        projectsFile: path.join(root, 'missing-projects.json'),
        resourcesFile: path.join(root, 'missing-resources.json')
    });
    try {
        const audit = createAuditService({ db, now: () => new Date('2026-07-30T00:00:00.000Z') });
        const event = audit.record('project.update', 'project', 'project-one', {
            fields: ['compatibilityDate'],
            accessToken: 'must-not-persist',
            note: 'x'.repeat(700)
        });
        assert.deepEqual(event.details.fields, ['compatibilityDate']);
        assert.equal(event.details.accessToken, '[REDACTED]');
        assert.equal(event.details.note.length, 512);

        const stored = audit.list(1)[0];
        assert.deepEqual(stored.details, event.details);
        assert.doesNotMatch(JSON.stringify(stored), /must-not-persist/);
    } finally {
        db.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
