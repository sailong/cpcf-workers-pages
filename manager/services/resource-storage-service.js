'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const config = require('../config');
const { getWranglerCommand } = require('../utils/wrangler-command');
const { createRuntimeEnvironment } = require('../utils/runtime-environment');

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const CLEANUP_TIMEOUT_MS = 45_000;

function quoteToml(value) {
    return JSON.stringify(value);
}

function workerSource(kind) {
    if (kind === 'kv') {
        return `export default { async fetch(request, env) {
  let deleted = 0;
  for (;;) {
    const page = await env.RESOURCE.list({ limit: 1000 });
    if (!page.keys.length) break;
    await Promise.all(page.keys.map(({ name }) => env.RESOURCE.delete(name)));
    deleted += page.keys.length;
  }
  return Response.json({ deleted });
} };\n`;
    }
    if (kind === 'r2') {
        return `export default { async fetch(request, env) {
  let deleted = 0;
  for (;;) {
    const page = await env.RESOURCE.list({ limit: 1000 });
    if (!page.objects.length) break;
    await env.RESOURCE.delete(page.objects.map(({ key }) => key));
    deleted += page.objects.length;
  }
  return Response.json({ deleted });
} };\n`;
    }
    return `export default { async fetch(request, env) {
  await env.RESOURCE.prepare('SELECT 1').first();
  return Response.json({ opened: true });
} };\n`;
}

function wranglerConfig(resource, kind) {
    const header = `name = "resource-cleaner"\nmain = "worker.js"\ncompatibility_date = "2024-09-23"\n`;
    if (kind === 'kv') {
        return `${header}\n[[kv_namespaces]]\nbinding = "RESOURCE"\nid = ${quoteToml(resource.id)}\npreview_id = ${quoteToml(resource.id)}\n`;
    }
    if (kind === 'd1') {
        return `${header}\n[[d1_databases]]\nbinding = "RESOURCE"\ndatabase_name = ${quoteToml(resource.name)}\ndatabase_id = ${quoteToml(resource.id)}\npreview_database_id = ${quoteToml(resource.id)}\n`;
    }
    return `${header}\n[[r2_buckets]]\nbinding = "RESOURCE"\nbucket_name = ${quoteToml(resource.id)}\n`;
}

function reservePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForWorker(url, child, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        if (child.spawnError) throw child.spawnError;
        if (child.exitCode !== null) throw new Error(`Wrangler cleaner exited with code ${child.exitCode}`);
        try {
            const response = await fetch(url, { method: 'POST' });
            if (!response.ok) throw new Error(await response.text());
            return await response.json();
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    throw new Error(`Timed out waiting for Wrangler cleaner: ${lastError ? lastError.message : 'unknown error'}`);
}

function stopProcessTree(child) {
    if (!child || child.exitCode !== null) return;
    try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
    } catch (error) {
        if (error.code !== 'ESRCH') child.kill('SIGTERM');
    }
}

function findProcessGroupStorageFiles(processGroupId, persistDir, kind) {
    if (!processGroupId) return [];
    const storageRoot = path.resolve(persistDir);
    const files = new Set();
    const consider = candidate => {
        let target = candidate.replace(/ \(deleted\)$/, '');
        if (!path.isAbsolute(target)) return;
        target = path.resolve(target);
        const relative = path.relative(storageRoot, target);
        if (relative.startsWith('..') || path.isAbsolute(relative)) return;
        if (!relative.split(path.sep).includes(kind)) return;
        if (/metadata\.sqlite(?:-wal|-shm)?$/.test(target)) return;
        if (/\.sqlite(?:-wal|-shm)?$/.test(target)) files.add(target);
    };

    if (process.platform === 'linux' && fs.existsSync('/proc')) {
        for (const entry of fs.readdirSync('/proc', { withFileTypes: true })) {
            if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
            try {
                const stat = fs.readFileSync(`/proc/${entry.name}/stat`, 'utf8');
                const fields = stat.slice(stat.lastIndexOf(') ') + 2).split(' ');
                if (Number(fields[2]) !== processGroupId) continue;
                for (const descriptor of fs.readdirSync(`/proc/${entry.name}/fd`)) {
                    consider(fs.readlinkSync(`/proc/${entry.name}/fd/${descriptor}`));
                }
            } catch {
                // Processes and descriptors may disappear during inspection.
            }
        }
    } else if (process.platform === 'darwin') {
        try {
            const processRows = execFileSync('/bin/ps', ['-axo', 'pid=,pgid='], { encoding: 'utf8' });
            const pids = processRows.split('\n').map(row => row.trim().split(/\s+/))
                .filter(parts => Number(parts[1]) === processGroupId).map(parts => parts[0]);
            if (pids.length) {
                const output = execFileSync('/usr/sbin/lsof', ['-Fn', '-p', pids.join(',')], { encoding: 'utf8' });
                for (const line of output.split('\n')) if (line.startsWith('n')) consider(line.slice(1));
            }
        } catch {
            // Fail closed below if the actor database cannot be identified.
        }
    }
    return [...files];
}

async function removeActorStorageFiles(files, persistDir) {
    const storageRoot = path.resolve(persistDir);
    const databaseBases = new Set(files.map(file => file.replace(/\.sqlite(?:-wal|-shm)?$/, '.sqlite')));
    for (const databaseFile of databaseBases) {
        const relative = path.relative(storageRoot, databaseFile);
        if (relative.startsWith('..') || path.isAbsolute(relative) || path.basename(databaseFile) === 'metadata.sqlite') {
            throw new Error('Refusing to remove storage outside the resource persistence root');
        }
        for (const suffix of ['', '-wal', '-shm']) await fs.promises.rm(`${databaseFile}${suffix}`, { force: true });
    }
}

async function runWranglerCleanup(resource, kind, persistDir, options = {}) {
    const dataDir = options.dataDir || config.DATA_DIR;
    const timeoutMs = options.timeoutMs || CLEANUP_TIMEOUT_MS;
    const temporaryDir = await fs.promises.mkdtemp(path.join(dataDir, 'resource-cleaner-'));
    const port = await reservePort();
    const inspectorPort = await reservePort();
    let child;
    let stderr = '';
    let actorFiles = [];
    try {
        await fs.promises.writeFile(path.join(temporaryDir, 'worker.js'), workerSource(kind), { mode: 0o600 });
        await fs.promises.writeFile(path.join(temporaryDir, 'wrangler.toml'), wranglerConfig(resource, kind), { mode: 0o600 });
        const wrangler = getWranglerCommand();
        child = spawn(wrangler.command, [
            ...wrangler.args, 'dev', '--config', 'wrangler.toml', '--ip', '127.0.0.1',
            '--port', String(port), '--inspector-port', String(inspectorPort), '--persist-to', persistDir
        ], {
            cwd: temporaryDir,
            env: createRuntimeEnvironment({ FORCE_COLOR: '0' }),
            stdio: ['ignore', 'ignore', 'pipe'],
            detached: process.platform !== 'win32'
        });
        child.stderr.on('data', chunk => {
            stderr = (stderr + chunk.toString()).slice(-4000);
        });
        child.once('error', error => {
            child.spawnError = error;
            stderr = `${stderr}\n${error.message}`;
        });
        const result = await waitForWorker(`http://127.0.0.1:${port}`, child, timeoutMs);
        actorFiles = findProcessGroupStorageFiles(child.pid, persistDir, kind);
        if (!actorFiles.length) {
            throw new Error('Wrangler cleanup completed but its resource storage file could not be identified');
        }
        return result;
    } catch (error) {
        if (stderr.trim()) error.message += `\n${stderr.trim()}`;
        throw error;
    } finally {
        stopProcessTree(child);
        await removeActorStorageFiles(actorFiles, persistDir);
        await fs.promises.rm(temporaryDir, { recursive: true, force: true });
    }
}

function createResourceStorageService(options = {}) {
    const dataDir = options.dataDir || config.DATA_DIR;
    const kvDataDir = options.kvDataDir || config.KV_DATA_DIR;
    const wranglerStateDir = options.wranglerStateDir || config.WRANGLER_STATE_DIR;
    const r2StateDir = options.r2StateDir || config.R2_STATE_DIR;
    const runner = options.runWranglerCleanup || ((resource, kind, persistDir) => runWranglerCleanup(resource, kind, persistDir, { dataDir }));
    const resourceRuntime = options.resourceRuntime || require('./resource-runtime');

    async function purge(resource) {
        if (!resource || !['kv', 'd1', 'r2'].includes(resource.kind)) throw new Error('Unsupported resource for physical cleanup');
        if (!RESOURCE_ID_PATTERN.test(resource.id)) throw new Error('Refusing to clean storage for an invalid resource ID');
        await fs.promises.mkdir(dataDir, { recursive: true, mode: 0o700 });

        await resourceRuntime.suspendResource(resource, async () => {
            if (resource.kind === 'kv') {
                await runner(resource, 'kv', wranglerStateDir);
                await fs.promises.rm(path.join(kvDataDir, `${resource.id}.json`), { force: true });
                return;
            }
            if (resource.kind === 'd1') {
                await runner(resource, 'd1', wranglerStateDir);
                return;
            }
            // Preserve compatibility with the historical shared and R2-specific roots.
            for (const stateDir of new Set([wranglerStateDir, r2StateDir])) {
                if (fs.existsSync(stateDir)) await runner(resource, 'r2', stateDir);
            }
        });
    }

    return { purge };
}

let singleton;
function service() {
    if (!singleton) singleton = createResourceStorageService();
    return singleton;
}

module.exports = {
    createResourceStorageService,
    findProcessGroupStorageFiles,
    purge: resource => service().purge(resource),
    runWranglerCleanup
};
