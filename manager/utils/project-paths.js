'use strict';

const path = require('node:path');
const config = require('../config');
const { resolveWithin } = require('./path-helper');

function isReleasePath(value) {
    return typeof value === 'string' && /^projects\/[^/]+\/releases\/[^/]+\/artifact(?:\/|$)/.test(value.replace(/\\/g, '/'));
}

function resolveProjectPath(value) {
    return resolveWithin(isReleasePath(value) ? config.DATA_DIR : config.UPLOADS_DIR, value);
}

function getReleaseRoot(value) {
    if (!isReleasePath(value)) return null;
    const normalized = value.replace(/\\/g, '/');
    const marker = '/artifact';
    const index = normalized.indexOf(marker);
    return resolveWithin(config.DATA_DIR, normalized.slice(0, index));
}

module.exports = { getReleaseRoot, isReleasePath, resolveProjectPath };
