'use strict';

const config = require('../config');
const { getApplicationVersion } = require('./application-version-service');

async function requestUpdater(pathname, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15_000);
    try {
        const response = await fetch(`${config.UPDATER_URL.replace(/\/$/, '')}${pathname}`, {
            method: options.method || 'GET',
            headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                authorization: `Bearer ${config.UPDATER_TOKEN}`
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: controller.signal
        });
        const text = await response.text();
        let payload;
        try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: text }; }
        if (!response.ok) {
            const error = new Error(payload.error || `Updater request failed (${response.status})`);
            error.statusCode = response.status;
            throw error;
        }
        return payload;
    } finally {
        clearTimeout(timeout);
    }
}

async function getStatus() {
    try {
        return await requestUpdater('/status');
    } catch (error) {
        return {
            available: false,
            currentVersion: getApplicationVersion(),
            operation: null,
            error: error.message
        };
    }
}

async function check(version) {
    return requestUpdater('/check', { method: 'POST', body: { version } });
}

async function startUpgrade(version) {
    return requestUpdater('/upgrade', { method: 'POST', body: { version } });
}

async function rollback() {
    return requestUpdater('/rollback', { method: 'POST', body: {} });
}

module.exports = { check, getStatus, rollback, startUpgrade };
