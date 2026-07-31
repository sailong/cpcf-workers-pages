'use strict';

const LIMIT_DEFINITIONS = {
    cpu: { fallback: 0.5, min: 0.1, max: 8 },
    // Wrangler Pages startup includes a local asset server and Miniflare;
    // 512 MB avoids OOM during normal local boot while remaining configurable.
    memoryMb: { fallback: 512, min: 64, max: 8192 },
    diskMb: { fallback: 512, min: 64, max: 102400 },
    uploadMb: { fallback: 100, min: 1, max: 1024 },
    concurrentRequests: { fallback: 50, min: 1, max: 10000, integer: true },
    buildTimeoutSeconds: { fallback: 600, min: 10, max: 3600, integer: true },
    pids: { fallback: 128, min: 16, max: 1024, integer: true }
};

function configuredFallback(key, definition) {
    const envName = `PROJECT_LIMIT_${key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`;
    const value = Number(process.env[envName]);
    return Number.isFinite(value) ? value : definition.fallback;
}

function normalizeProjectLimits(input = {}) {
    const limits = {};
    for (const [key, definition] of Object.entries(LIMIT_DEFINITIONS)) {
        const fallback = configuredFallback(key, definition);
        const raw = input[key] === undefined ? fallback : Number(input[key]);
        if (!Number.isFinite(raw) || raw < definition.min || raw > definition.max) {
            throw new Error(`${key} must be between ${definition.min} and ${definition.max}`);
        }
        if (definition.integer && !Number.isInteger(raw)) throw new Error(`${key} must be an integer`);
        limits[key] = raw;
    }
    return limits;
}

const DEFAULT_PROJECT_LIMITS = Object.freeze(normalizeProjectLimits());

module.exports = { DEFAULT_PROJECT_LIMITS, LIMIT_DEFINITIONS, normalizeProjectLimits };
