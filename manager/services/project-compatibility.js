'use strict';

const DEFAULT_COMPATIBILITY_DATE = '2024-09-23';
const DEFAULT_COMPATIBILITY_FLAGS = Object.freeze(['nodejs_compat']);

function validationError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function normalizeCompatibilityDate(value = DEFAULT_COMPATIBILITY_DATE) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw validationError('Compatibility date must use YYYY-MM-DD');
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw validationError('Compatibility date is not a valid calendar date');
    }
    return value;
}

function normalizeCompatibilityFlags(value = DEFAULT_COMPATIBILITY_FLAGS) {
    if (!Array.isArray(value) || value.length > 32) {
        throw validationError('Compatibility flags must be an array with at most 32 entries');
    }
    const flags = [];
    const seen = new Set();
    for (const flag of value) {
        if (typeof flag !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(flag)) {
            throw validationError('Compatibility flags must use lowercase letters, numbers, and underscores');
        }
        if (seen.has(flag)) throw validationError(`Duplicate compatibility flag: ${flag}`);
        seen.add(flag);
        flags.push(flag);
    }
    return flags;
}

function normalizeProjectCompatibility(project = {}) {
    return {
        compatibilityDate: normalizeCompatibilityDate(project.compatibilityDate),
        compatibilityFlags: normalizeCompatibilityFlags(project.compatibilityFlags)
    };
}

module.exports = {
    DEFAULT_COMPATIBILITY_DATE,
    DEFAULT_COMPATIBILITY_FLAGS,
    normalizeCompatibilityDate,
    normalizeCompatibilityFlags,
    normalizeProjectCompatibility
};
