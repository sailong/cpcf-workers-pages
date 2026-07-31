'use strict';

const config = require('../config');
const { getDatabase } = require('./database');

const MAX_ENTRY_BYTES = 8192;
const ANSI_PATTERN = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function sanitizeLine(value, maxBytes = MAX_ENTRY_BYTES) {
    const clean = String(value ?? '').replace(ANSI_PATTERN, '').replace(CONTROL_PATTERN, '');
    return Buffer.from(clean).subarray(0, maxBytes).toString('utf8');
}

function createRuntimeLogService(options = {}) {
    const db = options.db || getDatabase();
    const now = options.now || (() => new Date());
    const maxEntries = options.maxEntries ?? config.MAX_RUNTIME_LOGS_PER_PROJECT;
    const retentionMs = options.retentionMs ?? config.RUNTIME_LOG_RETENTION_MS;
    const maxEntryBytes = options.maxEntryBytes || MAX_ENTRY_BYTES;
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error('Runtime log retention count must be a positive integer');
    if (!Number.isFinite(retentionMs) || retentionMs <= 0) throw new Error('Runtime log retention duration must be positive');

    function prune(projectId) {
        const cutoff = new Date(now().getTime() - retentionMs).toISOString();
        db.prepare('DELETE FROM runtime_logs WHERE project_id = ? AND created_at < ?').run(projectId, cutoff);
        db.prepare(`DELETE FROM runtime_logs WHERE project_id = ? AND id NOT IN (
            SELECT id FROM runtime_logs WHERE project_id = ? ORDER BY id DESC LIMIT ?
        )`).run(projectId, projectId, maxEntries);
    }

    function append(projectId, stream, content) {
        if (!['stdout', 'stderr', 'system'].includes(stream)) throw new Error('Invalid runtime log stream');
        const lines = String(content ?? '').split(/\r?\n/).filter(line => line.length > 0);
        if (!lines.length) return [];
        const insert = db.prepare('INSERT INTO runtime_logs (project_id, stream, content, created_at) VALUES (?, ?, ?, ?)');
        const ids = [];
        db.transaction(() => {
            for (const line of lines) {
                const sanitized = sanitizeLine(line, maxEntryBytes);
                if (!sanitized) continue;
                ids.push(Number(insert.run(projectId, stream, sanitized, now().toISOString()).lastInsertRowid));
            }
        })();
        prune(projectId);
        return ids;
    }

    function list(projectId, options = {}) {
        const limit = Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 200, 500));
        const beforeId = Number.parseInt(options.beforeId, 10);
        const rows = Number.isSafeInteger(beforeId) && beforeId > 0
            ? db.prepare('SELECT * FROM runtime_logs WHERE project_id = ? AND id < ? ORDER BY id DESC LIMIT ?').all(projectId, beforeId, limit)
            : db.prepare('SELECT * FROM runtime_logs WHERE project_id = ? ORDER BY id DESC LIMIT ?').all(projectId, limit);
        return rows.reverse().map(row => ({
            id: row.id,
            projectId: row.project_id,
            stream: row.stream,
            content: row.content,
            createdAt: row.created_at
        }));
    }

    function clear(projectId) {
        return db.prepare('DELETE FROM runtime_logs WHERE project_id = ?').run(projectId).changes;
    }

    function pruneAll() {
        for (const row of db.prepare('SELECT DISTINCT project_id FROM runtime_logs').all()) prune(row.project_id);
    }

    return { append, clear, list, prune, pruneAll };
}

let singleton;
function service() {
    if (!singleton) singleton = createRuntimeLogService();
    return singleton;
}

module.exports = {
    createRuntimeLogService,
    sanitizeLine,
    append: (...args) => service().append(...args),
    clear: (...args) => service().clear(...args),
    list: (...args) => service().list(...args),
    prune: (...args) => service().prune(...args),
    pruneAll: (...args) => service().pruneAll(...args)
};
