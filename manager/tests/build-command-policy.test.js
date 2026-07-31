'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { planBuildCommand } = require('../utils/build-command-policy');

function workspace(scripts, { lockfile = true } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-build-policy-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'policy', scripts }, null, 2));
    if (lockfile) fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ name: 'policy', lockfileVersion: 3 }, null, 2));
    return root;
}

test('install stages open network and force --ignore-scripts', () => {
    const root = workspace({ build: 'vite build' });
    try {
        const plan = planBuildCommand('npm ci && npm run build', root);
        assert.equal(plan.stages.length, 2);
        assert.equal(plan.stages[0].needsNetwork, true);
        assert.equal(plan.stages[1].needsNetwork, false);
        assert.match(plan.stages[0].command, /--ignore-scripts/);
        assert.doesNotMatch(plan.stages[1].command, /--ignore-scripts/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('unsafe package scripts are rejected before a container starts', () => {
    const root = workspace({ build: 'node -e "require(\'child_process\').execSync(\'id\')"' });
    try {
        assert.throws(
            () => planBuildCommand('npm run build', root),
            error => error.statusCode === 400 && /package\.json 脚本 build 不安全|node 不允许/.test(error.message)
        );
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('relative node scripts remain allowed', () => {
    const root = workspace({ build: 'node scripts/build.js' });
    try {
        const plan = planBuildCommand('npm run build', root);
        assert.equal(plan.stages.length, 1);
        assert.equal(plan.needsNetwork, false);
        assert.match(plan.sanitized, /npm' 'run' 'build'/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('package installs require lockfiles and reject package additions', () => {
    const unlocked = workspace({ build: 'vite build' }, { lockfile: false });
    const locked = workspace({ build: 'vite build' }, { lockfile: true });
    try {
        assert.throws(
            () => planBuildCommand('npm install', unlocked),
            error => error.statusCode === 400 && /package-lock\.json/.test(error.message)
        );
        assert.throws(
            () => planBuildCommand('npm install lodash', locked),
            error => error.statusCode === 400 && /only lockfile installs/.test(error.message)
        );
        const plan = planBuildCommand('npm install', locked);
        assert.equal(plan.stages[0].needsNetwork, true);
        assert.match(plan.stages[0].command, /--ignore-scripts/);
    } finally {
        fs.rmSync(unlocked, { recursive: true, force: true });
        fs.rmSync(locked, { recursive: true, force: true });
    }
});


test('default network mode prefers offline cache for install stages', () => {
    const root = workspace({ build: 'vite build' });
    const previous = process.env.BUILD_NETWORK_MODE;
    try {
        delete process.env.BUILD_NETWORK_MODE;
        const plan = planBuildCommand('npm ci && npm run build', root);
        assert.match(plan.stages[0].command, /--prefer-offline/);
        assert.match(plan.stages[0].command, /--ignore-scripts/);
        assert.equal(plan.stages[1].needsNetwork, false);
    } finally {
        if (previous === undefined) delete process.env.BUILD_NETWORK_MODE;
        else process.env.BUILD_NETWORK_MODE = previous;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
