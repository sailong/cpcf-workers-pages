'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveInstallCommand } = require('../routes/projects');

test('install command selection prefers lockfile-driven package managers', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-install-cmd-'));
    try {
        assert.equal(resolveInstallCommand(root), null);
        fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
        assert.equal(resolveInstallCommand(root), 'npm ci');
        fs.writeFileSync(path.join(root, 'yarn.lock'), '');
        assert.equal(resolveInstallCommand(root), 'yarn install --frozen-lockfile');
        fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), '');
        assert.equal(resolveInstallCommand(root), 'pnpm install --frozen-lockfile');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
