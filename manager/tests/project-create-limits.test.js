'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getDirectorySize, assertPathWithinByteLimit } = require('../utils/fs-helper');

test('directory size helpers enforce project disk and upload budgets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-create-limits-'));
    try {
        const file = path.join(root, 'worker.js');
        fs.writeFileSync(file, 'x'.repeat(1024));
        assert.equal(getDirectorySize(file), 1024);
        assert.equal(getDirectorySize(root), 1024);
        assert.throws(
            () => assertPathWithinByteLimit(root, 512, 'Uploaded project exceeds upload limit (1 MB)'),
            error => error.statusCode === 413 && /upload limit/i.test(error.message)
        );
        assert.doesNotThrow(() => assertPathWithinByteLimit(root, 2048));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
