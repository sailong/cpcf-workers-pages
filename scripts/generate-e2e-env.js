#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

function generateE2EEnvironment(options = {}) {
    const outputFile = options.outputFile || process.env.GITHUB_ENV;
    const dataDir = options.dataDir || process.env.CCFWP_TEST_DATA_DIR;
    const randomBytes = options.randomBytes || crypto.randomBytes;
    if (!outputFile) throw new Error('GITHUB_ENV is required');
    if (!dataDir) throw new Error('CCFWP_TEST_DATA_DIR is required');

    const password = `E2E-a${randomBytes(24).toString('hex')}`;
    const captcha = randomBytes(16).toString('hex');
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    fs.appendFileSync(outputFile, [
        `CCFWP_TEST_PASSWORD=${password}`,
        `CCFWP_TEST_CAPTCHA=${captcha}`,
        `CCFWP_TEST_DATA_DIR=${dataDir}`
    ].join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
    return { password, captcha, dataDir };
}

if (require.main === module) {
    try {
        generateE2EEnvironment();
    } catch (error) {
        console.error(`Unable to generate E2E environment: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = { generateE2EEnvironment };
