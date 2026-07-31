'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

let secret;

function loadSecret() {
    if (secret) return secret;
    const encoded = fs.readFileSync(config.RESOURCE_GATEWAY_SECRET_FILE, 'utf8').trim();
    const decoded = Buffer.from(encoded, 'base64url');
    if (decoded.length !== 32) throw new Error('Resource gateway secret is invalid');
    secret = decoded;
    return secret;
}

async function initialize() {
    await fs.promises.mkdir(path.dirname(config.RESOURCE_GATEWAY_SECRET_FILE), { recursive: true, mode: 0o700 });
    try {
        const handle = await fs.promises.open(config.RESOURCE_GATEWAY_SECRET_FILE, 'wx', 0o600);
        try {
            await handle.writeFile(crypto.randomBytes(32).toString('base64url'));
        } finally {
            await handle.close();
        }
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
    await fs.promises.chmod(config.RESOURCE_GATEWAY_SECRET_FILE, 0o600);
    return loadSecret();
}

function initializeSync() {
    fs.mkdirSync(path.dirname(config.RESOURCE_GATEWAY_SECRET_FILE), { recursive: true, mode: 0o700 });
    try {
        fs.writeFileSync(config.RESOURCE_GATEWAY_SECRET_FILE, crypto.randomBytes(32).toString('base64url'), {
            flag: 'wx', mode: 0o600
        });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
    fs.chmodSync(config.RESOURCE_GATEWAY_SECRET_FILE, 0o600);
    return loadSecret();
}

function tokenForProject(projectId) {
    if (!secret) initializeSync();
    return crypto.createHmac('sha256', secret).update(`resource-gateway:${projectId}`).digest('base64url');
}

function verifyProjectToken(projectId, candidate) {
    if (typeof candidate !== 'string') return false;
    const expected = tokenForProject(projectId);
    const left = Buffer.from(expected);
    const right = Buffer.from(candidate);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function resetForTests() {
    secret = undefined;
}

module.exports = { initialize, initializeSync, tokenForProject, verifyProjectToken, resetForTests };
