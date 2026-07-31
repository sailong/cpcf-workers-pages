'use strict';

const crypto = require('node:crypto');
const { getDatabase } = require('./database');

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
    'authorization', 'cookie', 'password', 'secret', 'token', 'apikey', 'accesskey',
    'sql', 'query', 'body', 'payload', 'content', 'value', 'env', 'envvars', 'objectbody'
]);

function sensitiveKey(value) {
    const normalized = String(value).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    return SENSITIVE_KEYS.has(normalized)
        || normalized.endsWith('password')
        || normalized.endsWith('secret')
        || normalized.endsWith('token')
        || normalized.endsWith('authorization')
        || normalized.endsWith('body');
}

function safeString(value) {
    const sanitized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    if (/\bBearer\s+[A-Za-z0-9._~-]+/i.test(sanitized) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(sanitized)) {
        return REDACTED;
    }
    return sanitized.length > 512 ? `${sanitized.slice(0, 509)}...` : sanitized;
}

function sanitizeDetails(value, key = '', depth = 0, seen = new WeakSet()) {
    if (sensitiveKey(key)) return REDACTED;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return safeString(value);
    if (typeof value === 'bigint') return value.toString();
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return '[BINARY]';
    if (value instanceof Date) return value.toISOString();
    if (depth >= 6) return '[MAX_DEPTH]';
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);

    if (Array.isArray(value)) {
        const result = value.slice(0, 50).map(item => sanitizeDetails(item, '', depth + 1, seen));
        if (value.length > 50) result.push(`[${value.length - 50} MORE]`);
        return result;
    }

    const result = {};
    for (const [childKey, childValue] of Object.entries(value).slice(0, 50)) {
        const sanitized = sanitizeDetails(childValue, childKey, depth + 1, seen);
        if (sanitized !== undefined) result[childKey] = sanitized;
    }
    if (Object.keys(value).length > 50) result._truncated = true;
    return result;
}

function parseDetails(value) {
    try {
        const parsed = JSON.parse(value || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function hydrate(row) {
    return row ? {
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        details: parseDetails(row.details),
        createdAt: row.created_at
    } : null;
}

function createAuditService(options = {}) {
    const db = options.db || getDatabase();
    const now = options.now || (() => new Date());

    function record(action, entityType, entityId = null, details = {}) {
        if (!/^[a-z][a-z0-9_.-]{1,100}$/.test(action)) throw new Error('Invalid audit action');
        if (!/^[a-z][a-z0-9_-]{1,50}$/.test(entityType)) throw new Error('Invalid audit entity type');
        const event = {
            id: crypto.randomUUID(),
            action,
            entityType,
            entityId: entityId || null,
            details: sanitizeDetails(details),
            createdAt: now().toISOString()
        };
        db.prepare('INSERT INTO audit_events (id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(event.id, event.action, event.entityType, event.entityId, JSON.stringify(event.details), event.createdAt);
        return event;
    }

    function list(limit = 100) {
        const boundedLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 100, 500));
        return db.prepare('SELECT * FROM audit_events ORDER BY created_at DESC, id DESC LIMIT ?')
            .all(boundedLimit).map(hydrate);
    }

    return { list, record };
}

let singleton;
function service() {
    if (!singleton) singleton = createAuditService();
    return singleton;
}

module.exports = {
    createAuditService,
    sanitizeDetails,
    list: (...args) => service().list(...args),
    record: (...args) => service().record(...args)
};
