'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateE2EEnvironment } = require('../../scripts/generate-e2e-env');

const ROOT = path.resolve(__dirname, '../..');

test('CI credential generation writes bounded random values without shell interpolation', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-ci-env-'));
    const outputFile = path.join(directory, 'github-env');
    const dataDir = path.join(directory, 'data');
    try {
        const generated = generateE2EEnvironment({
            outputFile,
            dataDir,
            randomBytes: size => Buffer.alloc(size, size === 24 ? 0xab : 0xcd)
        });
        assert.equal(generated.password, `E2E-a${'ab'.repeat(24)}`);
        assert.equal(generated.captcha, 'cd'.repeat(16));
        assert.equal(fs.existsSync(dataDir), true);
        assert.equal(fs.readFileSync(outputFile, 'utf8'), [
            `CCFWP_TEST_PASSWORD=${generated.password}`,
            `CCFWP_TEST_CAPTCHA=${generated.captcha}`,
            `CCFWP_TEST_DATA_DIR=${dataDir}`,
            ''
        ].join('\n'));
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('CI workflow keeps cleanup-safe defaults and invokes the credential generator', () => {
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    assert.match(workflow, /CCFWP_TEST_PASSWORD: E2E-Cleanup-Fallback-Only-123/);
    assert.match(workflow, /CCFWP_TEST_DATA_DIR: \$\{\{ runner\.temp \}\}\/ccfwp-test-data/);
    assert.match(workflow, /run: node scripts\/generate-e2e-env\.js/);
    assert.doesNotMatch(workflow, /node -e \\"/);
});
