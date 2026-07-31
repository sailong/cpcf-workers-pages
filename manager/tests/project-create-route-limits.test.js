'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertCreateArtifactWithinLimits, assertProjectCodeUploadLimit } = require('../routes/projects');

test('create-time upload limit rejects oversized artifacts before project persistence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-create-route-'));
    try {
        const artifact = path.join(root, 'worker.js');
        fs.writeFileSync(artifact, 'x'.repeat(2 * 1024 * 1024));
        assert.throws(
            () => assertCreateArtifactWithinLimits(artifact, artifact, { uploadMb: 1, diskMb: 64 }),
            error => error.statusCode === 413 && /upload limit/i.test(error.message)
        );
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('create-time disk limit counts source plus artifact payload', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-create-disk-'));
    try {
        const artifact = path.join(root, 'dist');
        const source = path.join(root, 'source');
        fs.mkdirSync(artifact);
        fs.mkdirSync(source);
        fs.writeFileSync(path.join(artifact, 'index.js'), 'x'.repeat(700 * 1024));
        fs.writeFileSync(path.join(source, 'index.js'), 'y'.repeat(700 * 1024));
        assert.throws(
            () => assertCreateArtifactWithinLimits(artifact, source, { uploadMb: 10, diskMb: 1 }),
            error => error.statusCode === 413 && /disk limit/i.test(error.message)
        );
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('code update limit rejects oversized UTF-8 source before release creation', () => {
    assert.throws(
        () => assertProjectCodeUploadLimit({ limits: { uploadMb: 1 } }, 'x'.repeat(2 * 1024 * 1024)),
        error => error.statusCode === 413 && /upload limit/i.test(error.message)
    );
});
