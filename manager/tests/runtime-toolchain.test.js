'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getWranglerCommand } = require('../utils/wrangler-command');
const ProjectRuntime = require('../utils/spawner');
const { getInspectorPort, preparePagesReleaseWorkspace } = ProjectRuntime;
const { createRuntimeEnvironment } = require('../utils/runtime-environment');

test('runtime uses the repository-pinned Wrangler binary', () => {
    const managerPackage = require('../package.json');
    const wranglerPackage = require('wrangler/package.json');
    const miniflarePackage = require('miniflare/package.json');
    const wrangler = getWranglerCommand();

    assert.equal(managerPackage.dependencies.wrangler, wranglerPackage.version);
    assert.equal(wrangler.version, wranglerPackage.version);
    assert.equal(wrangler.command, process.execPath);
    assert.equal(path.basename(wrangler.args[0]), 'wrangler.js');
    assert.equal(fs.existsSync(wrangler.args[0]), true);
    assert.equal(managerPackage.dependencies.miniflare, miniflarePackage.version);
});

test('container Node version satisfies the pinned Wrangler runtime', () => {
    const dockerfile = fs.readFileSync(path.join(__dirname, '../../Dockerfile'), 'utf8');
    const fromImages = [...dockerfile.matchAll(/^FROM node:(\d+)-slim/gm)].map(match => Number(match[1]));

    assert.deepEqual(fromImages, [22, 22]);
    assert.doesNotMatch(dockerfile, /pnpm add -g wrangler/);
    assert.equal(require('../package.json').engines.node, '>=22.0.0');
});

test('platform runtime paths do not invoke network-resolved Wrangler commands', () => {
    const runtimeFiles = [
        '../utils/spawner.js',
        '../services/resource-storage-service.js'
    ];

    for (const relativePath of runtimeFiles) {
        const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
        assert.doesNotMatch(source, /npx\s+wrangler|spawn\(['"]npx['"]/);
        assert.match(source, /getWranglerCommand/);
    }

    const resourceRuntime = fs.readFileSync(path.join(__dirname, '../services/resource-runtime.js'), 'utf8');
    assert.match(resourceRuntime, /require\('miniflare'\)/);
    assert.doesNotMatch(resourceRuntime, /npx\s+wrangler|spawn\(['"]npx['"]/);
});

test('runtime lifecycle never kills arbitrary port owners', () => {
    const files = [
        '../../manager/server.js',
        '../routes/projects.js',
        '../services/runtime-service.js',
        '../utils/spawner.js'
    ];
    const source = files.map(relativePath => fs.readFileSync(path.join(__dirname, relativePath), 'utf8')).join('\n');

    assert.doesNotMatch(source, /port-killer|killProcessOnPort|fuser\s+-k|lsof\s+-t|taskkill/);
    assert.equal(fs.existsSync(path.join(__dirname, '../utils/port-killer.js')), false);
    assert.match(source, /process\.kill\(-child\.pid/);
    assert.match(source, /detached:\s*process\.platform !== 'win32'/);
});

test('process runtime always derives a valid inspector port', () => {
    assert.equal(getInspectorPort(10000), 20000);
    assert.equal(getInspectorPort(55535), 65535);
    assert.equal(getInspectorPort(57966), 47966);
    assert.equal(getInspectorPort(65535), 55535);
    assert.throws(() => getInspectorPort(0), /Invalid project runtime port/);
    assert.throws(() => getInspectorPort(65536), /Invalid project runtime port/);
});

test('build commands receive a minimal environment and managed process timeout', () => {
    const source = [
        '../utils/safe-exec.js',
        '../utils/spawner.js',
        '../services/resource-storage-service.js'
    ].map(relativePath => fs.readFileSync(path.join(__dirname, relativePath), 'utf8')).join('\n');
    assert.doesNotMatch(source, /\.\.\.process\.env/);
    assert.doesNotMatch(source, /shell:\s*true/);
    assert.match(source, /detached:\s*process\.platform !== 'win32'/);
    assert.match(source, /process\.kill\(-child\.pid/);
    assert.match(source, /Build|命令执行超时/);
});

test('project runtimes never inherit manager secrets', () => {
    const environment = createRuntimeEnvironment({ CI: 'true' }, {
        PATH: '/usr/bin',
        HOME: '/tmp/runtime-home',
        HTTP_PROXY: 'http://manager:password@proxy.internal:8080',
        HTTPS_PROXY: 'https://manager:password@proxy.internal:8443',
        NPM_CONFIG_REGISTRY: 'https://registry.example.test/',
        NPM_CONFIG_CACHE: '/private/manager-cache',
        NODE_EXTRA_CA_CERTS: '/private/manager-ca.pem',
        AUTH_PASSWORD: 'manager-password',
        INGRESS_PROXY_TOKEN: 'manager-ingress-token',
        CLOUDFLARE_API_TOKEN: 'manager-dns-token'
    });

    assert.deepEqual(environment, {
        PATH: '/usr/bin',
        HOME: '/tmp/runtime-home',
        NPM_CONFIG_REGISTRY: 'https://registry.example.test/',
        CI: 'true'
    });
    assert.equal(environment.AUTH_PASSWORD, undefined);
    assert.equal(environment.INGRESS_PROXY_TOKEN, undefined);
    assert.equal(environment.CLOUDFLARE_API_TOKEN, undefined);
    assert.equal(environment.HTTP_PROXY, undefined);
    assert.equal(environment.HTTPS_PROXY, undefined);
    assert.equal(environment.NPM_CONFIG_CACHE, undefined);
    assert.equal(environment.NODE_EXTRA_CA_CERTS, undefined);
    assert.equal(environment.NPM_CONFIG_REGISTRY, 'https://registry.example.test/');
});

test('Pages releases run from a disposable workspace and remain immutable', () => {
    const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ccfwp-pages-workspace-'));
    const release = path.join(root, 'release');
    const control = path.join(root, 'control');
    fs.mkdirSync(path.join(release, 'functions'), { recursive: true });
    fs.writeFileSync(path.join(release, 'index.html'), 'release-v1');
    fs.writeFileSync(path.join(release, 'functions', 'api.js'), 'export function onRequest() {}');

    try {
        const workspace = preparePagesReleaseWorkspace(release, control);
        assert.notEqual(workspace, release);
        assert.equal(fs.readFileSync(path.join(workspace, 'index.html'), 'utf8'), 'release-v1');
        assert.equal(fs.existsSync(path.join(workspace, 'functions', 'api.js')), true);

        fs.writeFileSync(path.join(workspace, 'index.html'), 'runtime-change');
        fs.writeFileSync(path.join(workspace, '.wrangler-state'), 'runtime-only');
        assert.equal(fs.readFileSync(path.join(release, 'index.html'), 'utf8'), 'release-v1');
        assert.equal(fs.existsSync(path.join(release, '.wrangler-state')), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('runtime log persistence failures never crash process lifecycle callbacks', () => {
    const runtime = new ProjectRuntime('/tmp', {}, {
        logService: {
            append() {
                throw new Error('database is closed');
            }
        }
    });
    const originalError = console.error;
    const errors = [];
    console.error = message => errors.push(message);

    try {
        assert.equal(runtime.appendLog('project-a', 'system', 'Runtime stopped'), false);
        assert.deepEqual(errors, [
            '[Runtime] Failed to persist system log for project project-a: database is closed'
        ]);
    } finally {
        console.error = originalError;
    }
});

test('server validates runtime isolation before opening the public listener', () => {
    const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    const readiness = source.indexOf('await runtimeService.startAll()');
    const listener = source.indexOf('app.listen(');

    assert.ok(readiness > 0);
    assert.ok(listener > readiness);
    assert.doesNotMatch(source, /runtimeService\.startAll\(\)\.catch/);
});

test('Docker runtime is the default provider for every environment', () => {
    const source = fs.readFileSync(path.join(__dirname, '../services/runtime-broker.js'), 'utf8');
    assert.match(source, /\|\| 'docker'/);
    assert.doesNotMatch(source, /NODE_ENV === 'production' \? 'docker' : 'process'/);
    assert.match(source, /RUNTIME_PROVIDER/);
});
