'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

function availablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function checkedFetch(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return response;
}

async function main() {
    const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-pages-process-'));
    const runtimePort = await availablePort();
    let gatewayPort = await availablePort();
    while (gatewayPort === runtimePort) gatewayPort = await availablePort();

    process.env.NODE_ENV = 'test';
    process.env.PLATFORM_DATA_DIR = testRoot;
    process.env.RESOURCE_GATEWAY_PORT = String(gatewayPort);
    process.env.HOME = testRoot;
    process.env.TMPDIR = testRoot;

    const config = require('../config');
    const ProjectRuntime = require('../utils/spawner');
    const resourceService = require('../services/resource-service');
    const projectService = require('../services/project-service');
    const resourceRuntime = require('../services/resource-runtime');
    const resourceGateway = require('../services/resource-gateway-server');
    const runtimeLogService = require('../services/runtime-log-service');
    const { getDatabase } = require('../services/database');

    const projectId = 'pages-process-integration';
    const releaseId = 'release-process-integration';
    const artifact = path.join(config.PROJECTS_DIR, projectId, 'releases', releaseId, 'artifact');
    const functionsDirectory = path.join(artifact, 'functions');
    fs.mkdirSync(functionsDirectory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(artifact, 'index.html'), '<h1>Process Pages fallback</h1>');
    fs.writeFileSync(path.join(functionsDirectory, 'api.js'), `export async function onRequest({ env }) {
        const object = await env.BUCKET.get('process.txt');
        return Response.json({
            kv: await env.CACHE.get('process'),
            count: await env.DB.prepare('SELECT COUNT(*) AS count FROM entries').first('count'),
            r2: object && await object.text()
        });
    }`);

    const kv = resourceService.create('kv', 'process-pages-kv');
    const d1 = resourceService.create('d1', 'process-pages-d1');
    const r2 = resourceService.create('r2', 'process-pages-r2');
    const bindings = {
        kv: [{ varName: 'CACHE', resourceId: kv.id }],
        d1: [{ varName: 'DB', resourceId: d1.id }],
        r2: [{ varName: 'BUCKET', resourceId: r2.id }]
    };
    const project = {
        id: projectId,
        name: projectId,
        type: 'pages',
        mainFile: `projects/${projectId}/releases/${releaseId}/artifact`,
        port: runtimePort,
        status: 'stopped',
        bindings,
        envVars: {},
        limits: {
            cpu: 0.25,
            memoryMb: 256,
            diskMb: 64,
            uploadMb: 10,
            concurrentRequests: 10,
            buildTimeoutSeconds: 60,
            pids: 64
        },
        createdAt: new Date().toISOString()
    };
    projectService.add(project);

    const runtime = new ProjectRuntime(config.UPLOADS_DIR, resourceService.getAll());
    try {
        await resourceRuntime.start(resourceService.getAllIncludingDeleted());
        await resourceRuntime.withResource('kv', kv.id, namespace => namespace.put('process', 'canonical'));
        await resourceRuntime.withResource('d1', d1.id, async database => {
            await database.exec('CREATE TABLE entries(id INTEGER PRIMARY KEY, value TEXT)');
            await database.prepare('INSERT INTO entries(value) VALUES (?)').bind('canonical').run();
        });
        await resourceRuntime.withResource('r2', r2.id, bucket => bucket.put('process.txt', 'canonical'));
        await resourceGateway.start();
        await runtime.start(project, { readinessTimeoutMs: 45_000 });

        const api = await checkedFetch(`http://127.0.0.1:${runtimePort}/api`);
        assert.equal(api.status, 200);
        assert.deepEqual(await api.json(), { kv: 'canonical', count: 1, r2: 'canonical' });
        const index = await checkedFetch(`http://127.0.0.1:${runtimePort}/`);
        assert.equal(index.status, 200);
        assert.match(await index.text(), /Process Pages fallback/);
        const source = await checkedFetch(`http://127.0.0.1:${runtimePort}/functions/api.js`);
        assert.equal(source.status, 404);

        console.log(JSON.stringify({
            success: true,
            provider: 'process',
            canonicalResources: ['kv', 'd1', 'r2'],
            staticFallback: true,
            sourceHidden: true
        }));
    } finally {
        const stopped = await runtime.stop(projectId);
        if (stopped) {
            assert.match(
                runtimeLogService.list(projectId, { limit: 20 }).map(entry => entry.content).join('\n'),
                /Runtime process exited/
            );
        }
        await resourceGateway.stop().catch(() => {});
        await resourceRuntime.dispose().catch(() => {});
        getDatabase().close();
        await new Promise(resolve => setTimeout(resolve, 250));
        fs.rmSync(testRoot, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
