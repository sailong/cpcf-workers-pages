'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const {
    backupDatabase,
    createDatabase,
    dryRunMigrations,
    restoreDatabaseBackup,
    SCHEMA_VERSION
} = require('../services/database');
const { normalizeVersion } = require('../services/application-version-service');
const { compareVersions, signerIdentityForRelease } = require('../../updater/release-client');
const { atomicSymlink, ensureInitialRelease, readCurrentVersion, versionDirectory } = require('../../updater/release-layout');

test('application versions require strict v-prefixed SemVer and compare numerically', () => {
    assert.equal(normalizeVersion('v1.2.3'), 'v1.2.3');
    assert.throws(() => normalizeVersion('latest'), /Invalid application version/);
    assert.throws(() => normalizeVersion('1.2.3'), /Invalid application version/);
    assert.ok(compareVersions('v1.10.0', 'v1.9.9') > 0);
    assert.equal(
        signerIdentityForRelease('owner/public.repository', 'v1.2.3'),
        'https://github.com/owner/public.repository/.github/workflows/app-release.yml@refs/tags/v1.2.3'
    );
});

test('database migration dry-run does not mutate the live database', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-app-migration-'));
    const databaseFile = path.join(root, 'control-plane.sqlite3');
    const db = createDatabase({
        databaseFile,
        projectsFile: path.join(root, 'missing-projects.json'),
        resourcesFile: path.join(root, 'missing-resources.json')
    });
    try {
        const before = db.pragma('user_version', { simple: true });
        const result = await dryRunMigrations({ databaseFile });
        assert.deepEqual(result, { fromVersion: before, toVersion: SCHEMA_VERSION });
        assert.equal(db.pragma('user_version', { simple: true }), before);
    } finally {
        db.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('database dry-run rejects a schema newer than the candidate without changing it', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-app-newer-schema-'));
    const databaseFile = path.join(root, 'control-plane.sqlite3');
    const db = new Database(databaseFile);
    db.pragma('user_version = 999');
    db.close();
    await assert.rejects(dryRunMigrations({ databaseFile }), /newer than supported/);
    const reopened = new Database(databaseFile, { readonly: true });
    assert.equal(reopened.pragma('user_version', { simple: true }), 999);
    reopened.close();
    fs.rmSync(root, { recursive: true, force: true });
});

test('database backup can restore the pre-upgrade control-plane snapshot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-app-backup-'));
    const databaseFile = path.join(root, 'control-plane.sqlite3');
    const backupFile = path.join(root, 'backup.sqlite3');
    const db = createDatabase({
        databaseFile,
        projectsFile: path.join(root, 'missing-projects.json'),
        resourcesFile: path.join(root, 'missing-resources.json')
    });
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run('release-test', 'before', new Date().toISOString());
    await backupDatabase(databaseFile, backupFile);
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('after', 'release-test');
    db.close();
    await restoreDatabaseBackup(backupFile, databaseFile);
    const restored = new Database(databaseFile, { readonly: true });
    assert.equal(restored.prepare('SELECT value FROM settings WHERE key = ?').get('release-test').value, 'before');
    restored.close();
    fs.rmSync(root, { recursive: true, force: true });
});

test('release layout seeds and atomically switches complete application snapshots', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-app-layout-'));
    const builtin = path.join(root, 'builtin');
    const releases = path.join(root, 'releases');
    fs.mkdirSync(path.join(builtin, 'manager'), { recursive: true });
    fs.writeFileSync(path.join(builtin, 'manager', 'server.js'), '');
    await ensureInitialRelease(releases, builtin, 'v1.0.0');
    assert.equal(readCurrentVersion(releases), 'v1.0.0');
    assert.ok(fs.existsSync(path.join(releases, 'current', 'manager', 'server.js')));
    fs.mkdirSync(path.join(releases, 'versions', 'v1.1.0', 'manager'), { recursive: true });
    await atomicSymlink(releases, 'v1.1.0');
    assert.equal(readCurrentVersion(releases), 'v1.1.0');
    assert.throws(() => versionDirectory(releases, '../../escape'), /Invalid release version/);
    fs.rmSync(path.join(releases, 'current'));
    fs.symlinkSync(os.tmpdir(), path.join(releases, 'current'), 'dir');
    assert.throws(() => readCurrentVersion(releases), /escapes the managed versions directory/);
    fs.rmSync(root, { recursive: true, force: true });
});
