'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { DockerRuntimeProvider } = require('../services/docker-runtime-provider');
const resourceService = require('../services/resource-service');
const projectService = require('../services/project-service');
const resourceRuntime = require('../services/resource-runtime');
const resourceGateway = require('../services/resource-gateway-server');

function runtimeFetch(url) {
    return fetch(url, { signal: AbortSignal.timeout(15_000) });
}

function fixture(id, source, bindings, port = 10001) {
    const releaseId = 'release-integration';
    const artifact = path.join(config.PROJECTS_DIR, id, 'releases', releaseId, 'artifact');
    fs.mkdirSync(artifact, { recursive: true, mode: 0o755 });
    fs.writeFileSync(path.join(artifact, 'index.js'), source, { mode: 0o644 });
    return {
        id,
        name: id,
        type: 'worker',
        mainFile: `projects/${id}/releases/${releaseId}/artifact/index.js`,
        port,
        bindings,
        envVars: {},
        limits: {
            cpu: 0.25,
            memoryMb: 512,
            diskMb: 64,
            uploadMb: 10,
            concurrentRequests: 10,
            buildTimeoutSeconds: 60,
            pids: 128
        }
    };
}

function pagesFixture(id, bindings) {
    const releaseId = 'release-integration';
    const artifact = path.join(config.PROJECTS_DIR, id, 'releases', releaseId, 'artifact');
    const functionsDirectory = path.join(artifact, 'functions');
    fs.mkdirSync(functionsDirectory, { recursive: true, mode: 0o755 });
    fs.writeFileSync(path.join(artifact, 'index.html'), '<h1>Pages static fallback</h1>', { mode: 0o644 });
    fs.writeFileSync(path.join(functionsDirectory, 'api.js'), `export async function onRequest({ env }) {
        const object = await env.BUCKET.get('shared.txt');
        return Response.json({
            kv: await env.CACHE.get('shared'),
            count: await env.DB.prepare('SELECT COUNT(*) AS count FROM entries').first('count'),
            r2: object && await object.text()
        });
    }`, { mode: 0o644 });
    return {
        ...fixture(id, 'export default {}', bindings, 10003),
        type: 'pages',
        mainFile: `projects/${id}/releases/${releaseId}/artifact`
    };
}

async function main() {
    if (process.env.RUN_DOCKER_INTEGRATION !== '1') {
        throw new Error('Set RUN_DOCKER_INTEGRATION=1 inside the isolated manager container');
    }
    const kv = resourceService.create('kv', 'broker-shared-kv');
    const d1 = resourceService.create('d1', 'broker-shared-d1');
    const r2 = resourceService.create('r2', 'broker-shared-r2');
    const bindings = {
        kv: [{ varName: 'CACHE', resourceId: kv.id }],
        d1: [{ varName: 'DB', resourceId: d1.id }],
        r2: [{ varName: 'BUCKET', resourceId: r2.id }]
    };
    const projectA = fixture('broker-integration-a', `export default { async fetch(request, env) {
        await env.CACHE.put('shared', 'runtime-a');
        await env.CACHE.put('blob', new Blob(['blob-a']));
        await env.DB.exec('CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY, value TEXT)');
        await env.DB.prepare('INSERT INTO entries(value) VALUES (?)').bind('runtime-a').run();
        await env.BUCKET.put('shared.txt', 'runtime-a');
        await env.BUCKET.put('blob.txt', new Blob(['blob-a']));
        const upload = await env.BUCKET.createMultipartUpload('multipart.txt');
        const part = await upload.uploadPart(1, 'runtime-multipart');
        await upload.complete([part]);
        return Response.json({ written: true });
    } };`, bindings);
    const projectB = fixture('broker-integration-b', `export default { async fetch(request, env) {
        const object = await env.BUCKET.get('shared.txt');
        const multipart = await env.BUCKET.get('multipart.txt');
        const blob = await env.BUCKET.get('blob.txt');
        return Response.json({
            kv: await env.CACHE.get('shared'),
            blobKv: await env.CACHE.get('blob'),
            count: await env.DB.prepare('SELECT COUNT(*) AS count FROM entries').first('count'),
            r2: object && await object.text(),
            blobR2: blob && await blob.text(),
            multipart: multipart && await multipart.text()
        });
    } };`, bindings, 10002);
    const pagesProject = pagesFixture('broker-integration-pages', bindings);
    projectService.add({ ...projectA, status: 'stopped', createdAt: new Date().toISOString() });
    projectService.add({ ...projectB, status: 'stopped', createdAt: new Date().toISOString() });
    projectService.add({ ...pagesProject, status: 'stopped', createdAt: new Date().toISOString() });
    const provider = new DockerRuntimeProvider({ resources: resourceService.getAll() });
    try {
        await resourceRuntime.start(resourceService.getAllIncludingDeleted());
        await resourceGateway.start();
        const capabilities = await provider.assertReady();
        await provider.start(projectA);
        const responseA = await runtimeFetch(provider.getTarget(projectA.id)).then(response => response.json());
        await provider.start(projectB);

        const runtimeA = provider.processes.get(projectA.id);
        const runtimeB = provider.processes.get(projectB.id);
        const [inspectA, inspectB, responseB] = await Promise.all([
            provider.engine.inspectContainer(runtimeA.containerId),
            provider.engine.inspectContainer(runtimeB.containerId),
            runtimeFetch(provider.getTarget(projectB.id)).then(response => response.json())
        ]);

        assert.deepEqual(responseA, { written: true });
        assert.deepEqual(responseB, {
            kv: 'runtime-a', blobKv: 'blob-a', count: 1, r2: 'runtime-a',
            blobR2: 'blob-a', multipart: 'runtime-multipart'
        });
        await provider.start(pagesProject);
        const pagesApi = await runtimeFetch(`${provider.getTarget(pagesProject.id)}/api`).then(response => response.json());
        const pagesIndex = await runtimeFetch(provider.getTarget(pagesProject.id));
        const pagesSource = await runtimeFetch(`${provider.getTarget(pagesProject.id)}/functions/api.js`);
        assert.deepEqual(pagesApi, { kv: 'runtime-a', count: 1, r2: 'runtime-a' });
        assert.equal(pagesIndex.status, 200);
        assert.match(await pagesIndex.text(), /Pages static fallback/);
        assert.equal(pagesSource.status, 404);
        assert.notEqual(runtimeA.networkId, runtimeB.networkId);
        for (const [inspection, project] of [[inspectA, projectA], [inspectB, projectB]]) {
            assert.equal(inspection.Config.User, '10001:10001');
            assert.equal(inspection.HostConfig.ReadonlyRootfs, true);
            assert.equal(inspection.HostConfig.Privileged, false);
            assert.deepEqual(inspection.HostConfig.CapDrop, ['ALL']);
            assert.equal(inspection.HostConfig.PidsLimit, 128);
            assert.equal(inspection.HostConfig.Memory, 512 * 1024 * 1024);
            assert.equal(inspection.HostConfig.NanoCpus, 250_000_000);
            const portBindings = inspection.HostConfig.PortBindings;
            assert.equal(portBindings === null || (typeof portBindings === 'object' && !Array.isArray(portBindings)), true);
            assert.deepEqual(Object.keys(portBindings || {}), []);
            assert.match(inspection.HostConfig.Tmpfs['/tmp'], /size=64m/);
            const mounts = inspection.Mounts.map(mount => mount.Source);
            assert.equal(mounts.some(source => source.includes('/var/run/docker.sock')), false);
            assert.equal(mounts.some(source => source.includes(project.id)), true);
            assert.equal(inspection.Mounts.every(mount => mount.RW === false), true);
            assert.match(inspection.Config.Cmd.join(' '), /--persist-to \/tmp\/state/);
            const networks = Object.keys(inspection.NetworkSettings.Networks);
            assert.equal(networks.length, 1);
        }

        const buildDirectory = path.join(config.TEMP_BUILD_DIR, 'broker-integration-build');
        fs.mkdirSync(buildDirectory, { recursive: true, mode: 0o755 });
        fs.mkdirSync(path.join(buildDirectory, 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(buildDirectory, 'scripts', 'build.js'), [
            "if (process.env.AUTH_PASSWORD) process.exit(9);",
            "require('node:fs').writeFileSync('artifact.txt', 'built');"
        ].join('\n'));
        fs.writeFileSync(path.join(buildDirectory, 'scripts', 'bloat.js'), "require('node:fs').writeFileSync('too-large.bin', Buffer.alloc(2 * 1024 * 1024));\n");
        fs.writeFileSync(path.join(buildDirectory, 'scripts', 'hang.js'), "setTimeout(() => {}, 5000);\n");
        fs.writeFileSync(path.join(buildDirectory, 'package.json'), JSON.stringify({
            private: true,
            scripts: {
                build: 'node scripts/build.js',
                bloat: 'node scripts/bloat.js',
                hang: 'node scripts/hang.js'
            }
        }, null, 2));
        await provider.runBuild(projectA, 'npm run build', {
            cwd: buildDirectory,
            timeout: 30_000
        });
        assert.equal(fs.readFileSync(path.join(buildDirectory, 'artifact.txt'), 'utf8'), 'built');

        const diskLimited = {
            ...projectA,
            limits: { ...projectA.limits, diskMb: 1 }
        };
        await assert.rejects(
            provider.runBuild(diskLimited, 'npm run bloat', {
                cwd: buildDirectory,
                timeout: 30_000
            }),
            /disk limit/
        );
        fs.rmSync(path.join(buildDirectory, 'too-large.bin'), { force: true });
        await assert.rejects(
            provider.runBuild(projectA, 'npm run hang', {
                cwd: buildDirectory,
                timeout: 500
            }),
            /time limit exceeded/
        );
        console.log(JSON.stringify({
            success: true,
            provider: capabilities.provider,
            engineVersion: capabilities.engineVersion,
            projects: 3,
            isolatedBuilds: 1,
            rejectedLimits: ['disk', 'build-time'],
            separateNetworks: true,
            canonicalResources: ['kv', 'd1', 'r2'],
            pages: { canonicalResources: true, staticFallback: true, sourceHidden: true },
            responses: [responseA, responseB, pagesApi]
        }));
    } finally {
        await Promise.allSettled([provider.stop(projectA.id), provider.stop(projectB.id), provider.stop(pagesProject.id)]);
        await resourceGateway.stop();
        await resourceRuntime.dispose();
        for (const project of [projectA, projectB, pagesProject]) {
            fs.rmSync(path.join(config.PROJECTS_DIR, project.id), { recursive: true, force: true });
            fs.rmSync(path.join(config.PROJECT_RUNTIME_STATE_DIR, project.id), { recursive: true, force: true });
        }
        fs.rmSync(path.join(config.TEMP_BUILD_DIR, 'broker-integration-build'), { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
