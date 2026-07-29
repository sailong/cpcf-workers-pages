'use strict';

const fs = require('fs');
const path = require('path');

class PathValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PathValidationError';
        this.code = 'INVALID_PATH';
    }
}

function decodePath(value) {
    let decoded = value;
    for (let i = 0; i < 4; i += 1) {
        const next = decodeURIComponent(decoded);
        if (next === decoded) return decoded;
        decoded = next;
    }
    throw new PathValidationError('Path is encoded too many times');
}

function resolveWithin(base, value, options = {}) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new PathValidationError('Path must be a non-empty string');
    }
    if (value.includes('\0') || value.includes('\n') || value.includes('\r')) {
        throw new PathValidationError('Path contains invalid characters');
    }

    let decoded;
    try {
        decoded = decodePath(value);
    } catch (error) {
        if (error instanceof PathValidationError) throw error;
        throw new PathValidationError('Path contains invalid encoding');
    }

    const portablePath = decoded.replace(/\\/g, '/');
    if (path.posix.isAbsolute(portablePath) || path.win32.isAbsolute(decoded)) {
        throw new PathValidationError('Absolute paths are not allowed');
    }

    const segments = portablePath.split('/');
    if (segments.some(segment => segment === '..')) {
        throw new PathValidationError('Path traversal is not allowed');
    }

    const resolvedBase = path.resolve(base);
    const resolvedPath = path.resolve(resolvedBase, portablePath);
    const insideRoot = resolvedPath === resolvedBase || resolvedPath.startsWith(`${resolvedBase}${path.sep}`);
    if (!insideRoot || (!options.allowBase && resolvedPath === resolvedBase)) {
        throw new PathValidationError('Path escapes the allowed root');
    }

    return resolvedPath;
}

function assertNoSymlinkWithin(base, target) {
    const root = path.resolve(base);
    const resolvedTarget = path.resolve(target);
    const relative = path.relative(root, resolvedTarget);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new PathValidationError('Path escapes the allowed root');
    }

    let current = root;
    for (const part of ['.', ...relative.split(path.sep).filter(Boolean)]) {
        if (part !== '.') current = path.join(current, part);
        try {
            if (fs.lstatSync(current).isSymbolicLink()) {
                throw new PathValidationError('Symbolic links are not allowed in project file paths');
            }
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
        }
    }
    return resolvedTarget;
}

module.exports = {
    assertNoSymlinkWithin,
    PathValidationError,
    resolveWithin
};
