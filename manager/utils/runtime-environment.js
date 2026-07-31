'use strict';

const PASSTHROUGH_KEYS = [
    'PATH',
    'HOME',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'TERM',
    'NO_PROXY',
    'NPM_CONFIG_REGISTRY',
    'WRANGLER_SEND_METRICS'
];

function safeValue(key, value) {
    if (key !== 'NPM_CONFIG_REGISTRY') return value;
    try {
        const url = new URL(value);
        if (url.username || url.password) return undefined;
    } catch {
        return undefined;
    }
    return value;
}

function createRuntimeEnvironment(overrides = {}, source = process.env) {
    const environment = {};
    for (const key of PASSTHROUGH_KEYS) {
        if (source[key] === undefined) continue;
        const value = safeValue(key, source[key]);
        if (value !== undefined) environment[key] = value;
    }
    return { ...environment, ...overrides };
}

module.exports = { createRuntimeEnvironment, PASSTHROUGH_KEYS, safeValue };
