'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-runtime-broker-'));
process.env.PLATFORM_DATA_DIR = testRoot;
process.env.PLATFORM_DATA_HOST_DIR = testRoot;
process.env.PROJECT_RUNTIME_IMAGE = 'ccfwp-platform:test';

const { DockerEngineClient, DockerEngineError } = require('../services/docker-engine-client');
const { DockerRuntimeProvider, decodeRuntimeMetrics, logDelta } = require('../services/docker-runtime-provider');
const { RuntimeBroker } = require('../services/runtime-broker');
const { createDockerBuildSpec, createDockerRuntimeSpec, OWNER_LABEL } = require('../services/docker-runtime-spec');
const { generateConfig, tomlValue } = require('../utils/generator');

test.after(() => fs.rmSync(testRoot, { recursive: true, force: true }));

test('Runtime Broker serializes concurrent lifecycle operations for one project', async () => {
    const events = [];
    const processes = new Map();
    const provider = {
        resources: {},
        processes,
        async start(project) {
            events.push('start:begin');
            await new Promise(resolve => setTimeout(resolve, 10));
            processes.set(project.id, project);
            events.push('start:end');
        },
        async stop(id) {
            events.push('stop:begin');
            await new Promise(resolve => setTimeout(resolve, 10));
            processes.delete(id);
            events.push('stop:end');
            return true;
        },
        isRunning: id => processes.has(id),
        getTarget: () => null,
        assertReady: async () => ({ provider: 'fake' }),
        collectObservability: async () => {},
        getMetrics: () => null,
        runBuild: async () => {}
    };
    const broker = new RuntimeBroker('', {}, { providerName: 'docker', provider });
    const project = { id: 'project-race', name: 'race' };

    await Promise.all([broker.start(project), broker.stop(project.id)]);
    assert.deepEqual(events, ['start:begin', 'start:end', 'stop:begin', 'stop:end']);
    assert.equal(broker.isRunning(project.id), false);
});

function projectFixture(overrides = {}) {
    const id = overrides.id || 'project-one';
    const releaseId = overrides.releaseId || 'release-one';
    const artifact = path.join(testRoot, 'projects', id, 'releases', releaseId, 'artifact');
    fs.mkdirSync(artifact, { recursive: true });
    fs.writeFileSync(path.join(artifact, 'index.js'), 'export default { fetch() { return new Response("ok") } };');
    return {
        id,
        name: 'project-one',
        type: 'worker',
        mainFile: `projects/${id}/releases/${releaseId}/artifact/index.js`,
        port: 10001,
        bindings: { kv: [], d1: [], r2: [] },
        envVars: { MODE: { type: 'plain', value: 'test' } },
        limits: {
            cpu: 0.5,
            memoryMb: 256,
            diskMb: 128,
            uploadMb: 10,
            concurrentRequests: 10,
            buildTimeoutSeconds: 60,
            pids: 64
        },
        ...overrides
    };
}

test('Docker runtime spec enforces container and network isolation', () => {
    const spec = createDockerRuntimeSpec(projectFixture(), { kv: [], d1: [], r2: [] });
    const container = spec.containerConfiguration;
    const host = container.HostConfig;

    assert.equal(container.Image, 'ccfwp-platform:test');
    assert.notEqual(container.User.split(':')[0], '0');
    assert.equal(host.ReadonlyRootfs, true);
    assert.equal(host.Privileged, false);
    assert.deepEqual(host.CapDrop, ['ALL']);
    assert.deepEqual(host.SecurityOpt, ['no-new-privileges:true']);
    assert.equal(host.PidsLimit, 64);
    assert.equal(host.Memory, 256 * 1024 * 1024);
    assert.equal(host.MemorySwap, host.Memory);
    assert.equal(host.NanoCpus, 500_000_000);
    assert.equal(host.NetworkMode, spec.networkName);
    assert.equal(host.PortBindings, undefined);
    assert.equal(spec.networkConfiguration.Options['com.docker.network.bridge.enable_icc'], 'false');
    assert.equal(spec.labels[OWNER_LABEL], 'true');
    assert.match(host.Tmpfs['/tmp'], /size=128m/);
    assert.equal(container.WorkingDir, '/tmp');

    const targets = host.Mounts.map(mount => mount.Target).sort();
    assert.deepEqual(targets, ['/runtime', '/workspace']);
    assert.equal(host.Mounts.find(mount => mount.Target === '/workspace').ReadOnly, true);
    assert.equal(host.Mounts.some(mount => mount.Source === '/var/run/docker.sock'), false);
    assert.equal(container.Env.some(item => item.startsWith('AUTH_') || item.startsWith('SESSION_')), false);
    assert.equal(container.Env.some(item => item.startsWith('RESOURCE_GATEWAY_')), false);
    assert.equal(container.Cmd.includes('--port'), true);
    assert.equal(container.Cmd.includes('8787'), true);
    assert.equal(container.Cmd.includes('/tmp/state'), true);
    assert.equal(host.Mounts.some(mount => mount.ReadOnly === false), false);
    const wrapper = fs.readFileSync(path.join(spec.controlDirectory, 'entry.mjs'), 'utf8');
    assert.match(wrapper, /ccfwp-manager-[a-f0-9]{20}:9200/);
    assert.match(wrapper, /bodyToArrayBuffer/);
    assert.match(wrapper, /value instanceof Blob/);
    assert.doesNotMatch(wrapper, /AUTH_PASSWORD|SESSION_SECRET/);
});

test('Docker runtime accepts only immutable project releases', () => {
    const project = projectFixture({ mainFile: 'legacy-upload.js' });
    assert.throws(
        () => createDockerRuntimeSpec(project, { kv: [], d1: [], r2: [] }),
        /immutable releases only/
    );
});

test('dynamic Pages Functions use the canonical gateway and hide runtime source from assets', () => {
    const id = 'pages-functions';
    const releaseId = 'release-pages-functions';
    const artifact = path.join(testRoot, 'projects', id, 'releases', releaseId, 'artifact');
    const functionsDirectory = path.join(artifact, 'functions');
    fs.mkdirSync(functionsDirectory, { recursive: true });
    fs.writeFileSync(path.join(artifact, 'index.html'), '<h1>static fallback</h1>');
    fs.writeFileSync(path.join(functionsDirectory, 'api.js'), 'export async function onRequest() { return new Response("api") }');
    const project = projectFixture({
        id,
        releaseId,
        name: id,
        type: 'pages',
        mainFile: `projects/${id}/releases/${releaseId}/artifact`,
        bindings: { kv: [{ varName: 'DATA', resourceId: 'kv-one' }], d1: [], r2: [] }
    });

    const spec = createDockerRuntimeSpec(project, {
        kv: [{ id: 'kv-one', name: 'shared' }], d1: [], r2: []
    });
    const command = spec.containerConfiguration.Cmd.join(' ');
    const wrapper = fs.readFileSync(path.join(spec.controlDirectory, 'entry.mjs'), 'utf8');
    const wranglerConfig = fs.readFileSync(path.join(spec.controlDirectory, 'wrangler.toml'), 'utf8');

    assert.match(command, /pages functions build/);
    assert.match(command, /timeout .*60s/);
    assert.match(command, /rm -rf \/tmp\/pages-assets\/functions \/tmp\/pages-assets\/_worker\.js/);
    assert.match(wrapper, /ccfwp-manager-[a-f0-9]{20}:9200/);
    assert.match(wrapper, /"DATA":\{"kind":"kv","resourceId":"kv-one"\}/);
    assert.match(wranglerConfig, /directory = "\/tmp\/pages-assets"/);
    assert.match(wranglerConfig, /binding = "ASSETS"/);
    assert.doesNotMatch(wranglerConfig, /\[\[kv_namespaces\]\]/);
    assert.equal(spec.startupTimeoutMs, 90_000);
});

test('Pages custom workers use sanitized assets without an unnecessary Functions build', () => {
    const id = 'pages-custom-worker';
    const releaseId = 'release-pages-custom-worker';
    const artifact = path.join(testRoot, 'projects', id, 'releases', releaseId, 'artifact');
    fs.mkdirSync(artifact, { recursive: true });
    fs.writeFileSync(path.join(artifact, 'index.html'), '<h1>static fallback</h1>');
    fs.writeFileSync(path.join(artifact, '_worker.js'), 'export default { fetch(request, env) { return env.ASSETS.fetch(request) } };');
    const project = projectFixture({
        id,
        releaseId,
        name: id,
        type: 'pages',
        mainFile: `projects/${id}/releases/${releaseId}/artifact`
    });

    const spec = createDockerRuntimeSpec(project, { kv: [], d1: [], r2: [] });
    const command = spec.containerConfiguration.Cmd.join(' ');
    const wrapper = fs.readFileSync(path.join(spec.controlDirectory, 'entry.mjs'), 'utf8');

    assert.doesNotMatch(command, /pages functions build/);
    assert.match(command, /rm -rf \/tmp\/pages-assets\/functions \/tmp\/pages-assets\/_worker\.js/);
    assert.match(wrapper, /import userWorker from "\/workspace\/_worker\.js"/);
});

test('static Pages runtimes honor project compatibility settings', () => {
    const id = 'pages-static';
    const releaseId = 'release-pages-static';
    const artifact = path.join(testRoot, 'projects', id, 'releases', releaseId, 'artifact');
    fs.mkdirSync(artifact, { recursive: true });
    fs.writeFileSync(path.join(artifact, 'index.html'), '<h1>static</h1>');
    const project = projectFixture({
        id,
        releaseId,
        name: id,
        type: 'pages',
        mainFile: `projects/${id}/releases/${releaseId}/artifact`,
        compatibilityDate: '2025-01-15',
        compatibilityFlags: ['streams_enable_constructors']
    });

    const spec = createDockerRuntimeSpec(project, { kv: [], d1: [], r2: [] });
    const command = spec.containerConfiguration.Cmd;
    assert.equal(command[command.indexOf('--compatibility-date') + 1], '2025-01-15');
    assert.equal(command[command.indexOf('--compatibility-flag') + 1], 'streams_enable_constructors');
    assert.equal(command.includes('nodejs_compat'), false);
});

test('Docker build spec mounts only its workspace and receives no manager secrets', () => {
    const previous = {
        AUTH_PASSWORD: process.env.AUTH_PASSWORD,
        HTTP_PROXY: process.env.HTTP_PROXY,
        NPM_CONFIG_REGISTRY: process.env.NPM_CONFIG_REGISTRY,
        BUILD_REGISTRY_ALLOWLIST: process.env.BUILD_REGISTRY_ALLOWLIST,
        BUILD_DEFAULT_REGISTRY: process.env.BUILD_DEFAULT_REGISTRY,
        BUILD_NETWORK_MODE: process.env.BUILD_NETWORK_MODE
    };
    process.env.AUTH_PASSWORD = 'must-not-leak';
    process.env.HTTP_PROXY = 'http://manager:password@proxy.internal:8080';
    process.env.NPM_CONFIG_REGISTRY = 'https://registry.example.test/';
    process.env.BUILD_REGISTRY_ALLOWLIST = 'https://registry.example.test/';
    process.env.BUILD_DEFAULT_REGISTRY = 'https://registry.example.test/';
    process.env.BUILD_NETWORK_MODE = 'online';
    try {
        const workDirectory = path.join(testRoot, 'temp_builds', 'isolated-build');
        fs.mkdirSync(workDirectory, { recursive: true });
        fs.writeFileSync(path.join(workDirectory, 'package.json'), JSON.stringify({
            name: 'fixture',
            scripts: { build: 'vite build' }
        }));
        fs.writeFileSync(path.join(workDirectory, 'package-lock.json'), JSON.stringify({ name: 'fixture', lockfileVersion: 3 }));
        const spec = createDockerBuildSpec(
            projectFixture(),
            'npm ci && npm run build',
            workDirectory,
            { runtimeKey: 'build-fixture' }
        );
        assert.equal(spec.stages.length, 2);
        assert.equal(spec.stages[0].needsNetwork, true);
        assert.equal(spec.stages[0].networkConfiguration.Internal, false);
        assert.equal(spec.stages[1].needsNetwork, false);
        assert.equal(spec.stages[1].networkConfiguration.Internal, true);
        assert.match(spec.stages[0].command, /--ignore-scripts/);
        assert.match(spec.sanitizedCommand, /npm' 'ci' '--ignore-scripts' && 'npm' 'run' 'build'/);

        const container = spec.containerConfiguration;
        const host = container.HostConfig;

        assert.equal(container.Cmd[0], '/bin/sh');
        assert.equal(container.Cmd[1], '-lc');
        assert.match(container.Cmd[2], /npm' 'ci' '--ignore-scripts'/);
        assert.equal(container.User, '10001:10001');
        assert.equal(host.ReadonlyRootfs, true);
        assert.deepEqual(host.CapDrop, ['ALL']);
        assert.deepEqual(host.SecurityOpt, ['no-new-privileges:true']);
        assert.equal(host.Mounts.length, 1);
        assert.equal(host.Mounts[0].Target, '/workspace');
        assert.equal(host.Mounts[0].ReadOnly, false);
        assert.equal(host.Mounts.some(mount => /runtime-state|docker\.sock|d1|kv-data|r2-data/.test(mount.Source)), false);
        assert.equal(container.Env.some(item => item.startsWith('AUTH_PASSWORD=')), false);
        assert.equal(container.Env.some(item => item.startsWith('HTTP_PROXY=')), false);
        assert.equal(container.Env.includes('NPM_CONFIG_REGISTRY=https://registry.example.test/'), true);
        assert.equal(host.PortBindings, undefined);
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('Docker observability decodes CPU and memory usage and deduplicates log tails', () => {
    const metrics = decodeRuntimeMetrics({
        cpu_stats: { cpu_usage: { total_usage: 300 }, system_cpu_usage: 1000, online_cpus: 2 },
        precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 600 },
        memory_stats: { usage: 1024, limit: 4096, stats: { inactive_file: 256 } },
        pids_stats: { current: 7 }
    });
    assert.equal(metrics.cpuPercent, 100);
    assert.equal(metrics.memoryBytes, 768);
    assert.equal(metrics.memoryLimitBytes, 4096);
    assert.equal(metrics.pids, 7);
    assert.equal(logDelta('one\ntwo\n', 'one\ntwo\nthree\n'), 'three\n');
    assert.equal(logDelta('one\ntwo\n', 'two\nthree\n'), 'three\n');
});

test('Docker runtime log persistence failures do not interrupt container lifecycle', () => {
    const provider = new DockerRuntimeProvider({
        engine: {},
        logService: { append: () => { throw new Error('database is closed'); } }
    });
    const originalError = console.error;
    const errors = [];
    console.error = message => errors.push(message);
    try {
        assert.equal(provider.appendLog('project-one', 'system', 'Runtime stopped'), false);
        assert.deepEqual(errors, [
            '[Runtime] Failed to persist system log for project project-one: database is closed'
        ]);
    } finally {
        console.error = originalError;
    }
});

test('TOML generation escapes strings and preserves structured JSON values', () => {
    assert.equal(tomlValue({ enabled: true, retries: 3, names: ['a', 'b'] }),
        '{ enabled = true, retries = 3, names = ["a", "b"] }');
    const config = generateConfig({
        id: 'p1',
        name: 'worker-name',
        type: 'worker',
        mainFile: '/workspace/index.js',
        port: 8787,
        bindings: {},
        envVars: {
            TEXT: { type: 'plain', value: 'quote"\nline' },
            JSON_VALUE: { type: 'json', value: { enabled: true, retries: 3 } }
        }
    }, { kv: [], d1: [], r2: [] });
    assert.match(config, /TEXT = "quote\\"\\nline"/);
    assert.match(config, /JSON_VALUE = \{ enabled = true, retries = 3 \}/);
});

test('Docker cleanup refuses containers not owned by the broker', async () => {
    const engine = {
        async inspectContainer() { return { Id: 'foreign', Config: { Labels: {} } }; }
    };
    const provider = new DockerRuntimeProvider({ engine, resources: {}, managerContainerId: 'manager' });
    await assert.rejects(
        provider.cleanupIdentifiers({ containerId: 'foreign' }),
        /Refusing to remove non-broker container/
    );
});

test('aborting a Docker build stops its container and removes its network', async () => {
    const controller = new AbortController();
    const removed = [];
    let inspections = 0;
    const engine = {
        async createNetwork() { return { Id: 'build-network' }; },
        async createContainer() { return { Id: 'build-container' }; },
        async startContainer() { },
        async inspectContainer() {
            inspections += 1;
            if (inspections === 1) controller.abort();
            return { Id: 'build-container', Config: { Labels: { [OWNER_LABEL]: 'true' } }, State: { Running: true } };
        },
        async containerLogs() { return Buffer.alloc(0); },
        async stopContainer() { removed.push('stopped'); },
        async removeContainer() { removed.push('container'); },
        async inspectNetwork() { return { Id: 'build-network', Labels: { [OWNER_LABEL]: 'true' } }; },
        async removeNetwork() { removed.push('network'); }
    };
    const provider = new DockerRuntimeProvider({ engine, resources: {}, managerContainerId: 'manager' });
    const workspace = path.join(testRoot, 'temp_builds', 'abort-build');
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({
        name: 'abort-build',
        scripts: { build: 'vite build' }
    }));

    await assert.rejects(
        provider.runBuild(projectFixture({ id: 'abort-build' }), 'npm run build', {
            cwd: workspace,
            signal: controller.signal
        }),
        error => error.name === 'AbortError'
    );
    assert.deepEqual(removed, ['stopped', 'container', 'network']);
});

test('Docker Engine client uses the Unix socket API and reports daemon errors', async () => {
    const socketPath = path.join('/tmp', `ccfwp-docker-${process.pid}.sock`);
    fs.rmSync(socketPath, { force: true });
    const seen = [];
    const server = http.createServer((request, response) => {
        seen.push(request.url);
        if (request.url === '/_ping') {
            response.writeHead(200);
            response.end('OK');
            return;
        }
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ message: 'missing' }));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(socketPath, resolve);
    });
    try {
        const client = new DockerEngineClient({ socketPath, apiVersion: 'v1.41' });
        assert.equal(await client.ping(), 'OK');
        await assert.rejects(
            client.inspectContainer('absent'),
            error => error instanceof DockerEngineError && error.statusCode === 404 && /missing/.test(error.message)
        );
        assert.deepEqual(seen, ['/_ping', '/v1.41/containers/absent/json']);
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(socketPath, { force: true });
    }
});


test('Docker build commands reject non-whitelisted shell syntax and reconstruct validated argv only', () => {
    const { createDockerBuildSpec, buildValidatedShellCommand } = require('../services/docker-runtime-spec');
    const workspace = path.join(testRoot, 'temp_builds', 'validated-build');
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({
        name: 'validated-build',
        scripts: {
            build: 'vite build -- --message "hello world"',
            test: 'tsc --noEmit'
        }
    }));
    assert.throws(
        () => buildValidatedShellCommand('npm run build; rm -rf /', workspace),
        /命令验证失败|不允许/
    );
    assert.throws(
        () => createDockerBuildSpec(projectFixture({ id: 'validated-build' }), 'curl http://evil.test', workspace),
        /命令验证失败|不允许|未知命令|not allowed|命令/
    );
    const sanitized = buildValidatedShellCommand('npm run build -- --message "hello world"', workspace);
    assert.match(sanitized, /npm/);
    assert.match(sanitized, /hello world/);
    assert.doesNotMatch(sanitized, /;|\||`|\$/);
    const spec = createDockerBuildSpec(projectFixture({ id: 'validated-build' }), 'npm run build && npm test', workspace);
    assert.deepEqual(spec.containerConfiguration.Cmd[0], '/bin/sh');
    assert.equal(spec.containerConfiguration.Cmd[1], '-lc');
    assert.match(spec.containerConfiguration.Cmd[2], /npm.*run.*build/);
    assert.equal(spec.stages.length, 1);
    assert.equal(spec.stages[0].needsNetwork, false);
    assert.equal(spec.stages[0].networkConfiguration.Internal, true);
});

test('Docker build planning hardens package installs and rejects unsafe package scripts', () => {
    const { createDockerBuildSpec, buildValidatedShellCommand } = require('../services/docker-runtime-spec');
    const { planBuildCommand } = require('../utils/build-command-policy');
    const workspace = path.join(testRoot, 'temp_builds', 'package-policy');
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({
        name: 'package-policy',
        scripts: {
            build: 'node -e "process.exit(0)"',
            safe: 'vite build'
        }
    }));

    assert.throws(
        () => buildValidatedShellCommand('npm run build', workspace),
        /package\.json 脚本 build 不安全|node 不允许/
    );

    fs.writeFileSync(path.join(workspace, 'package-lock.json'), JSON.stringify({ name: 'package-policy', lockfileVersion: 3 }));
    const plan = planBuildCommand('npm ci && npm run safe', workspace);
    assert.equal(plan.stages.length, 2);
    assert.equal(plan.stages[0].needsNetwork, true);
    assert.equal(plan.stages[1].needsNetwork, false);
    assert.match(plan.stages[0].command, /--ignore-scripts/);

    const spec = createDockerBuildSpec(projectFixture({ id: 'package-policy' }), 'npm ci && npm run safe', workspace);
    assert.equal(spec.stages[0].networkConfiguration.Internal, false);
    assert.equal(spec.stages[1].networkConfiguration.Internal, true);
});
