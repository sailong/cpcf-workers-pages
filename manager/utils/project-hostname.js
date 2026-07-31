'use strict';

const DNS_LABEL_MAX_LENGTH = 63;
const PROJECT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

function projectNameError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    error.publicMessage = message;
    return error;
}

function validateProjectName(name, type) {
    if (!['worker', 'pages'].includes(type)) throw projectNameError('Project type must be worker or pages');
    const maxLength = DNS_LABEL_MAX_LENGTH - type.length - 1;
    if (typeof name !== 'string' || !PROJECT_NAME_PATTERN.test(name) || name.length > maxLength) {
        throw projectNameError(`Project name must be 1-${maxLength} letters, numbers, or hyphens and cannot start or end with a hyphen`);
    }
    return name;
}

function splitList(value, fallback = []) {
    if (!value) return fallback;
    return String(value).split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
}

function normalizeHostname(hostname) {
    return String(hostname || '').toLowerCase().replace(/\.$/, '');
}

function configuredProjectBaseDomains(environment = process.env) {
    return splitList(environment.PROJECTS_BASE_DOMAINS || environment.PROJECTS_BASE_DOMAIN, ['localhost'])
        .map(normalizeHostname)
        .filter(Boolean);
}

function parseProjectHostname(hostname, baseDomains = configuredProjectBaseDomains()) {
    const normalized = normalizeHostname(hostname);
    for (const rawBase of baseDomains) {
        const baseDomain = normalizeHostname(rawBase);
        if (!baseDomain || !normalized.endsWith(`.${baseDomain}`)) continue;
        const label = normalized.slice(0, -(baseDomain.length + 1));
        const match = label.match(/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)-(worker|pages)$/);
        if (match) return { projectName: match[1], projectType: match[2], baseDomain };
    }
    return null;
}

module.exports = {
    DNS_LABEL_MAX_LENGTH,
    PROJECT_NAME_PATTERN,
    configuredProjectBaseDomains,
    normalizeHostname,
    parseProjectHostname,
    splitList,
    validateProjectName
};
