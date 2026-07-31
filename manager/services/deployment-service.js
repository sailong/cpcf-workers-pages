'use strict';

const crypto = require('node:crypto');
const config = require('../config');
const { getDatabase } = require('./database');

const MAX_LOG_ENTRIES = 2000;
const MAX_LOG_ENTRY_BYTES = 8192;
const MAX_LOG_BYTES = 1024 * 1024;

function parsePayload(value) {
    try {
        const parsed = JSON.parse(value || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function hydrate(row) {
    if (!row) return null;
    const payload = parsePayload(row.payload);
    return {
        id: row.id,
        projectId: row.project_id,
        status: row.status,
        kind: payload.kind || 'deployment',
        metadata: payload.metadata || {},
        logs: Array.isArray(payload.logs) ? payload.logs : [],
        startedAt: payload.startedAt || row.created_at,
        completedAt: payload.completedAt || null,
        result: payload.result || null,
        createdAt: row.created_at
    };
}

function createDeploymentService(options = {}) {
    const db = options.db || getDatabase();
    const now = options.now || (() => new Date());
    const maxLogEntries = options.maxLogEntries || MAX_LOG_ENTRIES;
    const maxLogEntryBytes = options.maxLogEntryBytes || MAX_LOG_ENTRY_BYTES;
    const maxLogBytes = options.maxLogBytes || MAX_LOG_BYTES;
    const maxOperations = options.maxOperations ?? config.MAX_OPERATIONS_PER_PROJECT;
    const retentionMs = options.retentionMs ?? config.OPERATION_RETENTION_MS;
    if (!Number.isInteger(maxOperations) || maxOperations < 1) throw new Error('Operation retention count must be a positive integer');
    if (!Number.isFinite(retentionMs) || retentionMs <= 0) throw new Error('Operation retention duration must be positive');

    function prune(projectId) {
        const cutoff = now().getTime() - retentionMs;
        const rows = db.prepare('SELECT id, status, payload, created_at FROM operations WHERE project_id = ? ORDER BY created_at DESC, id DESC')
            .all(projectId);
        let retainedCompleted = 0;
        const remove = [];
        for (const row of rows) {
            if (row.status === 'running') continue;
            const completedAt = parsePayload(row.payload).completedAt;
            const isFresh = Date.parse(completedAt || row.created_at) >= cutoff;
            if (retainedCompleted < maxOperations && isFresh) {
                retainedCompleted += 1;
            } else {
                remove.push(row.id);
            }
        }
        const statement = db.prepare('DELETE FROM operations WHERE id = ? AND status != ?');
        db.transaction(ids => ids.forEach(id => statement.run(id, 'running')))(remove);
        return remove;
    }

    function pruneAll() {
        return db.prepare('SELECT DISTINCT project_id FROM operations').all()
            .flatMap(row => prune(row.project_id));
    }

    function recoverInterrupted() {
        const rows = db.prepare("SELECT id FROM operations WHERE status = 'running'").all();
        for (const row of rows) {
            finish(row.id, 'interrupted', { error: 'Manager restarted before completion' });
        }
        return rows.length;
    }

    function start(projectId, kind, metadata = {}) {
        const id = `deployment-${crypto.randomUUID()}`;
        const createdAt = now().toISOString();
        const payload = { kind, metadata, logs: [], logBytes: 0, truncated: false, startedAt: createdAt };
        db.prepare('INSERT INTO operations (id, project_id, status, payload, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(id, projectId, 'running', JSON.stringify(payload), createdAt);
        prune(projectId);
        return hydrate(db.prepare('SELECT * FROM operations WHERE id = ?').get(id));
    }

    function mutate(id, operation) {
        const row = db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
        if (!row) return null;
        const payload = parsePayload(row.payload);
        const next = operation(payload, row) || {};
        const status = next.status || row.status;
        delete next.status;
        db.prepare('UPDATE operations SET status = ?, payload = ? WHERE id = ?')
            .run(status, JSON.stringify(next), id);
        return hydrate(db.prepare('SELECT * FROM operations WHERE id = ?').get(id));
    }

    function append(id, level, content) {
        return mutate(id, payload => {
            const logs = Array.isArray(payload.logs) ? payload.logs : [];
            let logBytes = Number.isSafeInteger(payload.logBytes) ? payload.logBytes : 0;
            if (logs.length >= maxLogEntries || logBytes >= maxLogBytes) {
                return { ...payload, logs, logBytes, truncated: true };
            }
            const raw = String(content ?? '');
            const entry = Buffer.from(raw).subarray(0, maxLogEntryBytes).toString('utf8');
            const remaining = maxLogBytes - logBytes;
            const bounded = Buffer.from(entry).subarray(0, remaining).toString('utf8');
            logBytes += Buffer.byteLength(bounded);
            logs.push({ timestamp: now().toISOString(), level, content: bounded });
            return {
                ...payload,
                logs,
                logBytes,
                truncated: payload.truncated || Buffer.byteLength(raw) > Buffer.byteLength(bounded)
            };
        });
    }

    function finish(id, status, result = null) {
        const deployment = mutate(id, (payload, row) => {
            if (row.status !== 'running') return { ...payload, status: row.status };
            return { ...payload, status, result, completedAt: now().toISOString() };
        });
        if (deployment && deployment.status !== 'running') prune(deployment.projectId);
        return deployment;
    }

    function list(projectId, limit = 50) {
        const boundedLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 100));
        return db.prepare('SELECT * FROM operations WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT ?')
            .all(projectId, boundedLimit).map(hydrate);
    }

    function listAll(limit = 100) {
        const boundedLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 100, 200));
        return db.prepare(`SELECT operations.*, projects.name AS project_name, projects.type AS project_type
            FROM operations
            JOIN projects ON projects.id = operations.project_id
            ORDER BY operations.created_at DESC, operations.id DESC LIMIT ?`)
            .all(boundedLimit).map(row => ({
                ...hydrate(row),
                projectName: row.project_name,
                projectType: row.project_type
            }));
    }

    function get(projectId, id) {
        return hydrate(db.prepare('SELECT * FROM operations WHERE id = ? AND project_id = ?').get(id, projectId));
    }

    function createRecorder(projectId, kind, metadata = {}) {
        const deployment = start(projectId, kind, metadata);
        return {
            deployment,
            onEvent(type, data = {}) {
                if (type === 'log') append(deployment.id, 'info', data.content);
                else if (type === 'error') {
                    append(deployment.id, 'error', data.content);
                    finish(deployment.id, 'failed', { error: String(data.content || 'Unknown error') });
                } else if (type === 'result') finish(deployment.id, 'succeeded', data);
            },
            interrupt() {
                finish(deployment.id, 'interrupted', { error: 'Event stream closed before completion' });
            }
        };
    }

    return { append, createRecorder, finish, get, list, listAll, prune, pruneAll, recoverInterrupted, start };
}

let singleton;
function service() {
    if (!singleton) singleton = createDeploymentService();
    return singleton;
}

module.exports = {
    MAX_LOG_BYTES,
    MAX_LOG_ENTRIES,
    MAX_LOG_ENTRY_BYTES,
    createDeploymentService,
    createRecorder: (...args) => service().createRecorder(...args),
    get: (...args) => service().get(...args),
    list: (...args) => service().list(...args),
    listAll: (...args) => service().listAll(...args),
    pruneAll: (...args) => service().pruneAll(...args),
    recoverInterrupted: (...args) => service().recoverInterrupted(...args)
};
