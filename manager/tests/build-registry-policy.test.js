'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function withIsolatedDataDir(run) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-registry-data-'));
    const previous = {
        PLATFORM_DATA_DIR: process.env.PLATFORM_DATA_DIR,
        PLATFORM_DATA_HOST_DIR: process.env.PLATFORM_DATA_HOST_DIR,
        NPM_CONFIG_REGISTRY: process.env.NPM_CONFIG_REGISTRY,
        BUILD_NETWORK_MODE: process.env.BUILD_NETWORK_MODE,
        BUILD_REGISTRY_ALLOWLIST: process.env.BUILD_REGISTRY_ALLOWLIST,
        BUILD_DEFAULT_REGISTRY: process.env.BUILD_DEFAULT_REGISTRY,
        AUTH_PASSWORD: process.env.AUTH_PASSWORD
    };
    process.env.PLATFORM_DATA_DIR = root;
    process.env.PLATFORM_DATA_HOST_DIR = root;
    process.env.AUTH_PASSWORD = 'must-not-leak';
    process.env.NPM_CONFIG_REGISTRY = 'https://evil.example/registry/';
    process.env.BUILD_REGISTRY_ALLOWLIST = 'https://registry.npmmirror.com/,https://registry.npmjs.org/';
    process.env.BUILD_DEFAULT_REGISTRY = 'https://registry.npmmirror.com/';
    process.env.BUILD_NETWORK_MODE = 'offline';

    for (const key of Object.keys(require.cache)) {
        if (key.includes(`${path.sep}manager${path.sep}config.js`) || key.includes(`${path.sep}manager${path.sep}services${path.sep}docker-runtime-spec.js`)) {
            delete require.cache[key];
        }
    }

    try {
        return run(root);
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        for (const key of Object.keys(require.cache)) {
            if (key.includes(`${path.sep}manager${path.sep}config.js`) || key.includes(`${path.sep}manager${path.sep}services${path.sep}docker-runtime-spec.js`)) {
                delete require.cache[key];
            }
        }
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test('build environment only exposes allowlisted registries and can force offline stages', () => {
    withIsolatedDataDir(root => {
        const { createDockerBuildSpec, resolveBuildRegistry, resolveBuildNetworkMode } = require('../services/docker-runtime-spec');
        const config = require('../config');
        assert.equal(resolveBuildRegistry(), 'https://registry.npmmirror.com/');
        assert.equal(resolveBuildNetworkMode(), 'offline');

        const workspace = path.join(config.TEMP_BUILD_DIR, 'registry-policy');
        fs.mkdirSync(workspace, { recursive: true });
        fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({
            name: 'registry-policy',
            scripts: { build: 'vite build' }
        }));
        fs.writeFileSync(path.join(workspace, 'package-lock.json'), JSON.stringify({ name: 'registry-policy', lockfileVersion: 3 }));
        const spec = createDockerBuildSpec({
            id: 'registry-policy',
            type: 'worker',
            limits: {
                cpu: 0.25,
                memoryMb: 512,
                diskMb: 64,
                uploadMb: 100,
                concurrentRequests: 8,
                buildTimeoutSeconds: 60,
                pids: 128
            }
        }, 'npm ci && npm run build', workspace);
        assert.equal(spec.networkMode, 'offline');
        assert.equal(spec.stages.every(stage => stage.networkConfiguration.Internal === true), true);
        assert.equal(spec.containerConfiguration.Env.includes('NPM_CONFIG_REGISTRY=https://registry.npmmirror.com/'), true);
        assert.equal(spec.containerConfiguration.Env.some(item => item.includes('evil.example')), false);
        assert.equal(spec.containerConfiguration.Env.some(item => item.startsWith('AUTH_PASSWORD=')), false);
    });
});

test('prefer-offline install commands receive package-manager offline preference flags', () => {
    const { planBuildCommand } = require('../utils/build-command-policy');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-prefer-offline-'));
    try {
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'prefer', scripts: { build: 'vite build' } }));
        fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ name: 'prefer', lockfileVersion: 3 }));
        const plan = planBuildCommand('npm ci && npm run build', root, { networkMode: 'prefer-offline' });
        assert.match(plan.stages[0].command, /--prefer-offline/);
        assert.match(plan.stages[0].command, /--ignore-scripts/);
        assert.equal(plan.stages[1].needsNetwork, false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});


test('default build network mode is prefer-offline', () => {
    const previous = process.env.BUILD_NETWORK_MODE;
    try {
        delete process.env.BUILD_NETWORK_MODE;
        delete require.cache[require.resolve('../config')];
        delete require.cache[require.resolve('../services/docker-runtime-spec')];
        const { resolveBuildNetworkMode } = require('../services/docker-runtime-spec');
        assert.equal(resolveBuildNetworkMode(), 'prefer-offline');
    } finally {
        if (previous === undefined) delete process.env.BUILD_NETWORK_MODE;
        else process.env.BUILD_NETWORK_MODE = previous;
        delete require.cache[require.resolve('../config')];
        delete require.cache[require.resolve('../services/docker-runtime-spec')];
    }
});
