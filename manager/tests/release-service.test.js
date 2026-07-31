'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../services/database');
const { createProjectService } = require('../services/project-service');
const { createReleaseService } = require('../services/release-service');

function fixture(options = {}) {
    const { projectLimits, ...releaseOptions } = options;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-release-'));
    const dataDir = path.join(root, 'data');
    const projectsDir = path.join(dataDir, 'projects');
    const uploadsDir = path.join(dataDir, 'uploads');
    const databaseFile = path.join(dataDir, 'control-plane.sqlite3');
    const db = createDatabase({
        databaseFile,
        projectsFile: path.join(root, 'missing-projects.json'),
        resourcesFile: path.join(root, 'missing-resources.json')
    });
    const projects = createProjectService({ db });
    projects.add({
        id: 'project-1', name: 'demo', type: 'worker', port: 10001, status: 'stopped',
        mainFile: null, bindings: {}, envVars: {}, limits: projectLimits,
        createdAt: '2026-01-01T00:00:00.000Z'
    });
    fs.mkdirSync(uploadsDir, { recursive: true });
    const releases = createReleaseService({ db, dataDir, projectsDir, uploadsDir, ...releaseOptions });
    return {
        root, dataDir, projectsDir, uploadsDir, db, projects, releases,
        file(name, content) {
            const target = path.join(root, name);
            fs.writeFileSync(target, content);
            return target;
        },
        uploadFile(name, content) {
            const target = path.join(uploadsDir, name);
            fs.writeFileSync(target, content);
            return target;
        },
        cleanup() {
            db.close();
            fs.rmSync(root, { recursive: true, force: true });
        }
    };
}

test('release creation rejects an oversized artifact before persistence and cleans staging', async () => {
    const f = fixture({ projectLimits: { uploadMb: 1, diskMb: 64 } });
    try {
        const artifact = f.file('oversized.js', 'x'.repeat(2 * 1024 * 1024));
        await assert.rejects(
            f.releases.create('project-1', { artifactPath: artifact }),
            error => error.statusCode === 413 && /artifact exceeds upload limit/i.test(error.message)
        );
        assert.equal(f.releases.list('project-1').length, 0);
        const projectRoot = path.join(f.projectsDir, 'project-1');
        assert.equal(fs.existsSync(path.join(projectRoot, 'releases')) ? fs.readdirSync(path.join(projectRoot, 'releases')).length : 0, 0);
        assert.equal(fs.existsSync(path.join(projectRoot, 'staging')) ? fs.readdirSync(path.join(projectRoot, 'staging')).length : 0, 0);
    } finally {
        f.cleanup();
    }
});

test('release creation enforces the upload limit for an uploaded source snapshot', async () => {
    const f = fixture({ projectLimits: { uploadMb: 1, diskMb: 64 } });
    try {
        const source = f.uploadFile('source.js', 'x'.repeat(2 * 1024 * 1024));
        const artifact = f.file('artifact.js', 'ok');
        await assert.rejects(
            f.releases.create('project-1', { sourcePath: source, artifactPath: artifact }),
            error => error.statusCode === 413 && /source exceeds upload limit/i.test(error.message)
        );
        assert.equal(f.releases.list('project-1').length, 0);
    } finally {
        f.cleanup();
    }
});

test('two immutable releases activate atomically and rollback to the previous release', async () => {
    const f = fixture();
    try {
        const source = f.file('worker.js', 'export default { fetch() { return new Response("v1") } }');
        const first = await f.releases.create('project-1', { sourcePath: source, artifactPath: source });
        const firstEntry = path.join(f.dataDir, first.entryPath);
        assert.equal(fs.readFileSync(firstEntry, 'utf8').includes('v1'), true);
        const entryMode = fs.statSync(firstEntry).mode & 0o777;
        const releaseMode = fs.statSync(path.dirname(firstEntry)).mode & 0o777;
        assert.ok([0o640, 0o644].includes(entryMode), `unexpected entry mode: ${entryMode.toString(8)}`);
        assert.ok([0o750, 0o755].includes(releaseMode), `unexpected release mode: ${releaseMode.toString(8)}`);

        fs.writeFileSync(source, 'export default { fetch() { return new Response("v2") } }');
        const second = await f.releases.create('project-1', { sourcePath: source, artifactPath: source });
        assert.notEqual(second.checksum, first.checksum);
        assert.equal(fs.readFileSync(firstEntry, 'utf8').includes('v1'), true);
        assert.equal(f.projects.getById('project-1').mainFile, second.entryPath);
        assert.deepEqual(f.releases.list('project-1').map(item => item.active), [true, false]);

        const rolledBack = await f.releases.rollback('project-1');
        assert.equal(rolledBack.id, first.id);
        assert.equal(f.projects.getById('project-1').mainFile, first.entryPath);
        assert.equal(fs.readFileSync(path.join(f.dataDir, first.entryPath), 'utf8').includes('v1'), true);
    } finally {
        f.cleanup();
    }
});

test('failed activation leaves the active release and staging state untouched', async () => {
    let fail = false;
    const f = fixture({ beforeCommit: () => { if (fail) throw new Error('injected activation failure'); } });
    try {
        const source = f.file('worker.js', 'v1');
        const first = await f.releases.create('project-1', { artifactPath: source });
        fail = true;
        fs.writeFileSync(source, 'v2');
        await assert.rejects(f.releases.create('project-1', { artifactPath: source }), /injected activation failure/);
        assert.equal(f.projects.getById('project-1').mainFile, first.entryPath);
        assert.equal(f.releases.list('project-1').length, 1);
        const projectRoot = path.join(f.projectsDir, 'project-1');
        const staging = path.join(projectRoot, 'staging');
        assert.deepEqual(fs.existsSync(staging) ? fs.readdirSync(staging) : [], []);
    } finally {
        f.cleanup();
    }
});

test('candidate validation runs before activation and failure preserves the active release', async () => {
    const f = fixture();
    try {
        const source = f.file('worker.js', 'v1');
        const first = await f.releases.create('project-1', { artifactPath: source });
        fs.writeFileSync(source, 'v2');
        const second = await f.releases.create('project-1', { artifactPath: source });
        await f.releases.rollback('project-1');
        const deploymentsBefore = f.db.prepare('SELECT COUNT(*) AS count FROM deployments').get().count;

        await assert.rejects(
            f.releases.activate('project-1', second.id, 'manual', {
                beforeActivate: release => {
                    assert.equal(release.id, second.id);
                    assert.equal(release.active, false);
                    throw new Error('candidate failed readiness');
                }
            }),
            /candidate failed readiness/
        );

        assert.equal(f.projects.getById('project-1').activeReleaseId, first.id);
        assert.equal(f.releases.list('project-1').find(release => release.active).id, first.id);
        assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM deployments').get().count, deploymentsBefore);
    } finally {
        f.cleanup();
    }
});

test('concurrent release creation is serialized per project', async () => {
    const order = [];
    let unblockFirst;
    const firstBlocked = new Promise(resolve => { unblockFirst = resolve; });
    let commits = 0;
    const f = fixture({
        beforeCommit: async ({ releaseId }) => {
            order.push(`start:${releaseId}`);
            commits += 1;
            if (commits === 1) await firstBlocked;
            order.push(`end:${releaseId}`);
        }
    });
    try {
        const firstSource = f.file('one.js', 'one');
        const secondSource = f.file('two.js', 'two');
        const firstPromise = f.releases.create('project-1', { artifactPath: firstSource });
        await new Promise(resolve => setImmediate(resolve));
        const secondPromise = f.releases.create('project-1', { artifactPath: secondSource });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(order.length, 1);
        unblockFirst();
        const [first, second] = await Promise.all([firstPromise, secondPromise]);
        assert.deepEqual(order, [`start:${first.id}`, `end:${first.id}`, `start:${second.id}`, `end:${second.id}`]);
        assert.equal(f.releases.list('project-1').find(item => item.active).id, second.id);
    } finally {
        f.cleanup();
    }
});

test('legacy projects migrate before runtime restore and remove only their old storage root', async () => {
    const f = fixture();
    try {
        const legacyFile = path.join(f.uploadsDir, 'legacy-worker.js');
        fs.writeFileSync(legacyFile, 'legacy-version');
        f.projects.update('project-1', { mainFile: 'legacy-worker.js' });

        const result = await f.releases.migrateLegacyProjects();
        assert.equal(result.migrated.length, 1);
        assert.equal(result.skipped.length, 0);
        assert.equal(fs.existsSync(legacyFile), false);
        const project = f.projects.getById('project-1');
        assert.match(project.mainFile, /^projects\/project-1\/releases\/release-/);
        assert.equal(fs.readFileSync(path.join(f.dataDir, project.mainFile), 'utf8'), 'legacy-version');
    } finally {
        f.cleanup();
    }
});

test('release retention preserves the active and rollback releases and bounds activation history', async () => {
    const f = fixture({ maxReleases: 3, maxActivations: 4 });
    try {
        const source = f.file('worker.js', 'version-0');
        for (let index = 0; index < 6; index += 1) {
            fs.writeFileSync(source, `version-${index}`);
            await f.releases.create('project-1', { artifactPath: source });
        }

        const releases = f.releases.list('project-1');
        assert.equal(releases.length, 3);
        assert.equal(releases[0].active, true);
        assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM deployments WHERE project_id = ?').get('project-1').count, 4);
        const releaseDirectories = fs.readdirSync(path.join(f.projectsDir, 'project-1', 'releases'));
        assert.equal(releaseDirectories.length, 3);

        const rolledBack = await f.releases.rollback('project-1');
        assert.equal(rolledBack.id, releases[1].id);
        assert.equal(f.releases.list('project-1').find(item => item.active).id, releases[1].id);
    } finally {
        f.cleanup();
    }
});
