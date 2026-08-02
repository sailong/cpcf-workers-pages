'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const config = require('../manager/config');
const { DockerEngineClient } = require('../manager/services/docker-engine-client');
const { normalizeVersion } = require('../manager/services/application-version-service');
const { backupDatabase, restoreDatabaseBackup } = require('../manager/services/database');
const { compareVersions, downloadAndVerify } = require('./release-client');
const {
    atomicSymlink,
    currentDirectory,
    ensureInitialRelease,
    readCurrentVersion,
    readJson,
    versionDirectory
} = require('./release-layout');

const PORT = Number.parseInt(process.env.UPDATER_PORT || '8002', 10);
const MANAGER_HEALTH_TIMEOUT_MS = Number.parseInt(process.env.CCFWP_MANAGER_HEALTH_TIMEOUT_MS || '180000', 10);
const ROOT = config.APP_RELEASE_ROOT;
const STATE_FILE = path.join(ROOT, 'state.json');
const LOCK_FILE = path.join(ROOT, '.upgrade.lock');
const CONTAINER_ID = process.env.MANAGER_CONTAINER_ID || 'ccfwp-container';
const docker = new DockerEngineClient();

let state = {
    available: true,
    currentVersion: null,
    previousVersion: null,
    retainedVersions: [],
    operation: null
};

function persistState() {
    const temporary = `${STATE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, STATE_FILE);
}

function loadState() {
    fs.rmSync(LOCK_FILE, { force: true });
    const loaded = readJson(STATE_FILE, null);
    if (loaded && typeof loaded === 'object') state = { ...state, ...loaded, available: true };
    if (state.operation?.status === 'running' || state.operation?.status === 'queued') {
        state.operation.status = 'failed';
        state.operation.message = 'Upgrade process was interrupted and was not switched';
        state.operation.completedAt = new Date().toISOString();
    }
    state.currentVersion = readCurrentVersion(ROOT) || state.currentVersion;
    if (state.currentVersion) state.retainedVersions = listVersions();
    persistState();
}

function listVersions() {
    const versionsRoot = path.join(ROOT, 'versions');
    try {
        return fs.readdirSync(versionsRoot, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(entry.name))
            .map(entry => entry.name)
            .sort(compareVersions)
            .reverse();
    } catch { return []; }
}

function acquireLock() {
    try {
        const descriptor = fs.openSync(LOCK_FILE, 'wx', 0o600);
        return () => { try { fs.closeSync(descriptor); } catch { } try { fs.rmSync(LOCK_FILE, { force: true }); } catch { } };
    } catch (error) {
        if (error.code === 'EEXIST') throw Object.assign(new Error('Another application upgrade is already running'), { statusCode: 409 });
        throw error;
    }
}

async function extractBundle(bundlePath, destination) {
    const listing = await execFileAsync('tar', ['-tzf', bundlePath], { maxBuffer: 4 * 1024 * 1024 });
    for (const item of listing.stdout.split('\n').map(value => value.trim()).filter(Boolean)) {
        if (item.startsWith('/') || item.split('/').includes('..')) throw new Error(`Unsafe release archive entry: ${item}`);
    }
    await execFileAsync('tar', ['-xzf', bundlePath, '-C', destination], { maxBuffer: 1024 * 1024 });
    const managerRoot = path.join(destination, 'manager');
    for (const required of [
        path.join(managerRoot, 'server.js'),
        path.join(managerRoot, 'scripts', 'migrate-database.js'),
        path.join(managerRoot, 'node_modules'),
        path.join(managerRoot, 'client', 'dist')
    ]) {
        if (!fs.existsSync(required)) throw new Error(`Release archive is missing ${path.relative(destination, required)}`);
    }
}

async function runDryRun(candidateRoot) {
    const migrationScript = path.join(candidateRoot, 'manager', 'scripts', 'migrate-database.js');
    const result = await execFileAsync(process.execPath, [migrationScript], {
        env: { ...process.env, PLATFORM_DATA_DIR: config.DATA_DIR, CCFWP_MIGRATION_DATABASE_FILE: config.DATABASE_FILE },
        maxBuffer: 2 * 1024 * 1024
    });
    return result.stdout.trim();
}

function healthStateDetails(inspected) {
    const state = inspected?.State || {};
    const health = state.Health || {};
    const latest = Array.isArray(health.Log) ? health.Log.at(-1) : null;
    const output = String(latest?.Output || '').trim().replace(/\s+/g, ' ').slice(-600);
    return [
        health.Status || state.Status || 'starting',
        state.Restarting ? 'container restarting' : '',
        state.Error || '',
        output
    ].filter(Boolean).join('; ');
}

async function waitForHealthy(timeoutMs = MANAGER_HEALTH_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
        try {
            const inspected = await docker.inspectContainer(CONTAINER_ID);
            const health = inspected.State?.Health?.Status;
            if (inspected.State?.Running && (!health || health === 'healthy')) return inspected;
            last = healthStateDetails(inspected);
        } catch (error) { last = error.message; }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Manager did not become healthy: ${last || 'timeout'}`);
}

async function restartManager() {
    await docker.restartContainer(CONTAINER_ID, 15);
    return waitForHealthy();
}

async function retainVersions() {
    const versions = listVersions();
    const keep = new Set([state.currentVersion, state.previousVersion, ...versions.slice(0, Math.max(3, config.RELEASE_RETENTION || 3))].filter(Boolean));
    for (const version of versions) if (!keep.has(version)) await fs.promises.rm(versionDirectory(ROOT, version), { recursive: true, force: true });
    state.retainedVersions = listVersions();
}

async function applyUpgrade(targetVersion, operation) {
    const releaseDirectory = await fs.promises.mkdtemp(path.join(ROOT, 'staging-'));
    const downloadDirectory = path.join(releaseDirectory, 'download');
    const candidateDirectory = path.join(releaseDirectory, 'candidate');
    const databaseBackup = path.join(releaseDirectory, 'control-plane.sqlite3.backup');
    const stateBeforeSwitch = {
        currentVersion: state.currentVersion,
        previousVersion: state.previousVersion
    };
    let installed = false;
    try {
        const downloaded = await downloadAndVerify(targetVersion, downloadDirectory);
        if (state.currentVersion && compareVersions(downloaded.tag, state.currentVersion) <= 0) {
            throw new Error(`Upgrade target ${downloaded.tag} must be newer than current version ${state.currentVersion}`);
        }
        operation.targetVersion = downloaded.tag;
        await fs.promises.mkdir(candidateDirectory, { recursive: true, mode: 0o700 });
        await extractBundle(downloaded.bundlePath, candidateDirectory);
        operation.phase = 'migrationDryRun';
        operation.message = 'Running database migration dry-run';
        persistState();
        operation.migration = JSON.parse(await runDryRun(candidateDirectory));
        await backupDatabase(config.DATABASE_FILE, databaseBackup);

        const destination = versionDirectory(ROOT, downloaded.tag);
        await fs.promises.rm(destination, { recursive: true, force: true });
        await fs.promises.rename(candidateDirectory, destination);
        await fs.promises.writeFile(path.join(destination, 'manifest.json'), JSON.stringify(downloaded.manifest, null, 2), { mode: 0o600 });
        state.previousVersion = state.currentVersion;
        state.currentVersion = downloaded.tag;
        await atomicSymlink(ROOT, downloaded.tag);
        installed = true;
        operation.phase = 'restarting';
        operation.message = 'Restarting manager and waiting for health';
        persistState();
        await restartManager();
        operation.status = 'succeeded';
        operation.phase = 'completed';
        operation.message = 'Upgrade completed';
    } catch (error) {
        operation.message = error.message;
        if (installed && state.previousVersion) {
            state.currentVersion = stateBeforeSwitch.currentVersion;
            state.previousVersion = stateBeforeSwitch.previousVersion;
            try {
                await docker.stopContainer(CONTAINER_ID, 15);
                await atomicSymlink(ROOT, state.currentVersion);
                await restoreDatabaseBackup(databaseBackup, config.DATABASE_FILE);
                await docker.startContainer(CONTAINER_ID);
                await waitForHealthy();
                operation.status = 'rolled_back';
                operation.phase = 'restored';
                operation.message = `Upgrade failed and was rolled back: ${error.message}`;
            } catch (rollbackError) {
                operation.status = 'failed';
                operation.phase = 'failed';
                operation.message = `${error.message}; automatic rollback failed: ${rollbackError.message}`;
            }
        } else {
            operation.status = 'failed';
            operation.phase = 'failed';
        }
    } finally {
        operation.completedAt = new Date().toISOString();
        state.currentVersion = readCurrentVersion(ROOT) || state.currentVersion;
        await retainVersions();
        persistState();
        await fs.promises.rm(releaseDirectory, { recursive: true, force: true });
    }
}

async function applyRollback(operation) {
    if (!state.previousVersion) throw new Error('No previous application release is available');
    const target = state.previousVersion;
    if (!fs.existsSync(versionDirectory(ROOT, target))) throw new Error(`Previous release snapshot is missing: ${target}`);
    const stateBeforeSwitch = { currentVersion: state.currentVersion, previousVersion: state.previousVersion };
    const rollbackDirectory = await fs.promises.mkdtemp(path.join(ROOT, 'rollback-'));
    const databaseBackup = path.join(rollbackDirectory, 'control-plane.sqlite3.backup');
    let switched = false;
    try {
        operation.phase = 'rollbackCompatibility';
        operation.message = 'Checking previous release database compatibility';
        persistState();
        await runDryRun(versionDirectory(ROOT, target));
        await backupDatabase(config.DATABASE_FILE, databaseBackup);
        await atomicSymlink(ROOT, target);
        const oldCurrent = state.currentVersion;
        state.currentVersion = target;
        state.previousVersion = oldCurrent;
        switched = true;
        operation.targetVersion = target;
        operation.phase = 'restarting';
        operation.message = 'Restarting manager and waiting for health';
        persistState();
        await restartManager();
        operation.status = 'succeeded';
        operation.phase = 'completed';
        operation.message = 'Rollback completed';
    } catch (error) {
        if (switched) {
            state.currentVersion = stateBeforeSwitch.currentVersion;
            state.previousVersion = stateBeforeSwitch.previousVersion;
            try {
                await docker.stopContainer(CONTAINER_ID, 15);
                await atomicSymlink(ROOT, state.currentVersion);
                await restoreDatabaseBackup(databaseBackup, config.DATABASE_FILE);
                await docker.startContainer(CONTAINER_ID);
                await waitForHealthy();
                operation.status = 'rolled_back';
                operation.phase = 'restored';
                operation.message = `Rollback failed and the original release was restored: ${error.message}`;
            } catch (restoreError) {
                operation.status = 'failed';
                operation.phase = 'failed';
                operation.message = `${error.message}; restoring the original release failed: ${restoreError.message}`;
            }
        } else {
            operation.status = 'failed';
            operation.phase = 'failed';
            operation.message = error.message;
        }
    } finally {
        operation.completedAt = new Date().toISOString();
        await retainVersions();
        persistState();
        await fs.promises.rm(rollbackDirectory, { recursive: true, force: true });
    }
}

function startOperation(kind, targetVersion, runner) {
    if (state.operation && ['queued', 'running'].includes(state.operation.status)) {
        const error = Object.assign(new Error('Another application operation is already running'), { statusCode: 409 });
        throw error;
    }
    const operation = {
        id: crypto.randomUUID(),
        kind,
        targetVersion: targetVersion || null,
        status: 'queued',
        phase: 'queued',
        message: 'Queued',
        startedAt: new Date().toISOString(),
        completedAt: null
    };
    state.operation = operation;
    persistState();
    setImmediate(async () => {
        let release = () => {};
        try {
            release = acquireLock();
            operation.status = 'running';
            operation.phase = 'preparing';
            operation.message = 'Preparing signed release';
            persistState();
            await runner(operation);
        } catch (error) {
            operation.status = 'failed';
            operation.phase = 'failed';
            operation.message = error.message;
            operation.completedAt = new Date().toISOString();
            persistState();
        } finally { release(); }
    });
    return { ...state, operation };
}

async function handle(request, response) {
    if (request.url !== '/health') {
        const token = process.env.CCFWP_UPDATER_TOKEN || '';
        const expected = Buffer.from(`Bearer ${token}`);
        const supplied = Buffer.from(String(request.headers.authorization || ''));
        if (!token || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
            return send(response, 401, { error: 'Unauthorized updater request' });
        }
    }
    const chunks = [];
    let bodyBytes = 0;
    for await (const chunk of request) {
        bodyBytes += chunk.length;
        if (bodyBytes > 64 * 1024) return send(response, 413, { error: 'Updater request body is too large' });
        chunks.push(chunk);
    }
    let body = {};
    if (chunks.length) {
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { response.writeHead(400); response.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
    }
    try {
        if (request.method === 'GET' && request.url === '/health') return send(response, 200, { ok: true });
        if (request.method === 'GET' && request.url === '/status') return send(response, 200, state);
        if (request.method === 'POST' && request.url === '/check') {
            const { findRelease } = require('./release-client');
            const release = await findRelease(body.version || undefined);
            return send(response, 200, { ...state, candidate: { version: release.tag_name, name: release.name, publishedAt: release.published_at } });
        }
        if (request.method === 'POST' && request.url === '/upgrade') {
            const version = normalizeVersion(body.version);
            return send(response, 202, startOperation('upgrade', version, operation => applyUpgrade(version, operation)));
        }
        if (request.method === 'POST' && request.url === '/rollback') {
            return send(response, 202, startOperation('rollback', state.previousVersion, applyRollback));
        }
        send(response, 404, { error: 'Not found' });
    } catch (error) {
        send(response, error.statusCode || 500, { error: error.message });
    }
}

function send(response, status, payload) {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(payload));
}

async function main() {
    await fs.promises.mkdir(ROOT, { recursive: true, mode: 0o700 });
    await ensureInitialRelease(ROOT, '/opt/ccfwp-builtin', process.env.CCFWP_BUILTIN_VERSION || 'v1.0.0');
    loadState();
    const server = http.createServer((request, response) => void handle(request, response));
    server.requestTimeout = 15_000;
    server.headersTimeout = 10_000;
    server.listen(PORT, '0.0.0.0', () => console.log(`CCFWP updater listening on ${PORT}`));
}

main().catch(error => { console.error(`[Updater] ${error.stack || error.message}`); process.exit(1); });

module.exports = { compareVersions: require('./release-client').compareVersions, listVersions, retainVersions };
