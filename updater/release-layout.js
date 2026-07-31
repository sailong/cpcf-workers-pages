'use strict';

const fs = require('fs');
const path = require('path');
const VERSION_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function readJson(file, fallback = null) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function versionDirectory(root, version) {
    if (!VERSION_PATTERN.test(String(version || ''))) throw new Error(`Invalid release version: ${version || '(empty)'}`);
    return path.join(root, 'versions', version);
}

function currentDirectory(root) {
    return path.join(root, 'current');
}

function resolveCurrentDirectory(root) {
    const versionsRoot = fs.realpathSync(path.resolve(root, 'versions'));
    const resolved = fs.realpathSync(currentDirectory(root));
    const relative = path.relative(versionsRoot, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !VERSION_PATTERN.test(path.basename(resolved))) {
        throw new Error('Current release pointer escapes the managed versions directory');
    }
    return resolved;
}

async function atomicSymlink(root, version) {
    const target = path.relative(root, versionDirectory(root, version));
    const temporary = path.join(root, `.current-${process.pid}-${Date.now()}`);
    await fs.promises.symlink(target, temporary, 'dir');
    await fs.promises.rename(temporary, currentDirectory(root));
}

async function ensureInitialRelease(root, builtinRoot, builtinVersion = 'v1.0.0') {
    await fs.promises.mkdir(path.join(root, 'versions'), { recursive: true, mode: 0o700 });
    try {
        await fs.promises.stat(currentDirectory(root));
        return;
    } catch { /* seed below */ }
    const version = builtinVersion;
    const target = versionDirectory(root, version);
    await fs.promises.rm(target, { recursive: true, force: true });
    await fs.promises.cp(builtinRoot, target, { recursive: true, force: false, errorOnExist: true });
    await fs.promises.writeFile(path.join(target, 'manifest.json'), JSON.stringify({ version, source: 'docker-image' }, null, 2), { mode: 0o600 });
    await atomicSymlink(root, version);
}

function readCurrentVersion(root) {
    try {
        return path.basename(resolveCurrentDirectory(root));
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

module.exports = {
    atomicSymlink,
    currentDirectory,
    ensureInitialRelease,
    readCurrentVersion,
    readJson,
    resolveCurrentDirectory,
    versionDirectory
};
