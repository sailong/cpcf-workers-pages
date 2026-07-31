'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createAuthService } = require('../services/auth-service');

const execFileAsync = promisify(execFile);

test('admin password reset script updates the persisted credential without exposing it', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ccfwp-password-reset-'));
    const password = 'ResetStrong123';
    try {
        const result = await execFileAsync(process.execPath, [path.resolve(__dirname, '../scripts/reset-admin-password.js')], {
            env: {
                ...process.env,
                NODE_ENV: 'test',
                PLATFORM_DATA_DIR: directory,
                CCFWP_ADMIN_PASSWORD: password
            },
            maxBuffer: 1024 * 1024
        });
        assert.match(result.stdout, /Administrator password updated/);
        assert.doesNotMatch(result.stdout, new RegExp(password));
        assert.doesNotMatch(result.stderr, new RegExp(password));

        const auth = createAuthService({
            authFile: path.join(directory, 'auth.json'),
            initialPassword: null
        });
        await auth.initialize();
        assert.equal(await auth.verifyPassword(password), true);
    } finally {
        await fs.promises.rm(directory, { recursive: true, force: true });
    }
});
