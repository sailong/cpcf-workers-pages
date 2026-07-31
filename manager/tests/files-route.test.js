'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertProjectDiskLimit, assertProjectUploadLimit, getProjectContentLimitBytes } = require('../routes/files');
const { getDirectorySize } = require('../utils/fs-helper');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-files-route-'));
    return {
        root,
        project: { limits: { diskMb: 64, uploadMb: 1 } },
        cleanup() {
            fs.rmSync(root, { recursive: true, force: true });
        }
    };
}

test('project file writes reject content above the project upload limit with HTTP 413 semantics', () => {
    const f = fixture();
    try {
        assert.throws(
            () => assertProjectUploadLimit(f.project, 2 * 1024 * 1024),
            error => error.statusCode === 413 && /upload limit/i.test(error.message)
        );
        assert.equal(getProjectContentLimitBytes(f.project), 1 * 1024 * 1024);
    } finally {
        f.cleanup();
    }
});

test('project file writes reject projected disk usage above the project limit', () => {
    const f = fixture();
    try {
        fs.writeFileSync(path.join(f.root, 'existing.js'), 'existing');
        assert.throws(
            () => assertProjectDiskLimit(f.project, f.root, path.join(f.root, 'new.js'), 64 * 1024 * 1024),
            error => error.statusCode === 413 && /disk limit exceeded/i.test(error.message)
        );
    } finally {
        f.cleanup();
    }
});

test('project file replacement subtracts the previous file size before enforcing the limit', () => {
    const f = fixture();
    try {
        const target = path.join(f.root, 'existing.js');
        fs.writeFileSync(target, 'old content');
        assert.doesNotThrow(() => assertProjectDiskLimit(f.project, f.root, target, 64 * 1024 * 1024));
        assert.equal(getDirectorySize(f.root), Buffer.byteLength('old content'));
    } finally {
        f.cleanup();
    }
});
