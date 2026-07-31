'use strict';

const fs = require('node:fs');
const config = require('../config');
const { resolveWithin } = require('../utils/path-helper');

const BUILD_ID_PATTERN = /^build-[0-9a-f-]{36}$/i;

function createBuildArtifactService(options = {}) {
    const root = options.root || config.TEMP_BUILD_DIR;
    const ttlMs = options.ttlMs ?? config.BUILD_ARTIFACT_TTL_MS;
    const now = options.now || (() => new Date());
    const active = new Set();
    let cleanupTimer = null;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('Build artifact TTL must be a positive number');

    function resolve(buildId) {
        if (!BUILD_ID_PATTERN.test(buildId)) throw new Error('Invalid build ID');
        return resolveWithin(root, buildId);
    }

    function begin(buildId) {
        const workspace = resolve(buildId);
        active.add(buildId);
        return workspace;
    }

    function retain(buildId) {
        const workspace = resolve(buildId);
        active.delete(buildId);
        if (fs.existsSync(workspace)) {
            const timestamp = now();
            fs.utimesSync(workspace, timestamp, timestamp);
        }
    }

    function discard(buildId) {
        const workspace = resolve(buildId);
        active.delete(buildId);
        fs.rmSync(workspace, { recursive: true, force: true });
    }

    function cleanupExpired() {
        fs.mkdirSync(root, { recursive: true, mode: 0o700 });
        const cutoff = now().getTime() - ttlMs;
        const removed = [];
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || !BUILD_ID_PATTERN.test(entry.name) || active.has(entry.name)) continue;
            const workspace = resolve(entry.name);
            if (fs.statSync(workspace).mtimeMs >= cutoff) continue;
            fs.rmSync(workspace, { recursive: true, force: true });
            removed.push(entry.name);
        }
        return removed;
    }

    function startScheduler(intervalMs = Math.min(ttlMs, 60 * 60 * 1000)) {
        if (cleanupTimer) return;
        cleanupTimer = setInterval(cleanupExpired, Math.max(1_000, intervalMs));
        cleanupTimer.unref();
    }

    function stopScheduler() {
        if (!cleanupTimer) return;
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }

    return { begin, cleanupExpired, discard, retain, startScheduler, stopScheduler };
}

const service = createBuildArtifactService();
service.createBuildArtifactService = createBuildArtifactService;

module.exports = service;
