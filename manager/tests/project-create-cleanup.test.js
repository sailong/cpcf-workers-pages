'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cleanupInitialProjectFiles } = require('../routes/projects');

test('failed initial activation removes project upload and temporary build trees', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-create-cleanup-'));
    const uploadsDir = path.join(root, 'uploads');
    const tempBuildDir = path.join(root, 'temp-builds');
    const projectDir = path.join(uploadsDir, 'page-example');
    const buildDir = path.join(tempBuildDir, 'build-1');
    fs.mkdirSync(path.join(projectDir, 'dist'), { recursive: true });
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'dist', 'index.html'), 'ok');
    fs.writeFileSync(path.join(buildDir, 'bundle.js'), 'ok');

    try {
        cleanupInitialProjectFiles({
            actualMainFile: 'page-example/dist',
            buildId: 'build-1',
            config: { UPLOADS_DIR: uploadsDir, TEMP_BUILD_DIR: tempBuildDir }
        });
        assert.equal(fs.existsSync(projectDir), false);
        assert.equal(fs.existsSync(buildDir), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('initial activation cleanup ignores paths outside managed roots', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-create-cleanup-safe-'));
    const uploadsDir = path.join(root, 'uploads');
    const tempBuildDir = path.join(root, 'temp-builds');
    const outside = path.join(root, 'outside.txt');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(tempBuildDir, { recursive: true });
    fs.writeFileSync(outside, 'keep');

    try {
        cleanupInitialProjectFiles({
            actualMainFile: '../outside.txt',
            buildId: '../outside.txt',
            config: { UPLOADS_DIR: uploadsDir, TEMP_BUILD_DIR: tempBuildDir },
            logger: { warn() {} }
        });
        assert.equal(fs.existsSync(outside), true);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
