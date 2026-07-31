'use strict';

const crypto = require('crypto');
const { getDatabase } = require('./database');

const KINDS = ['kv', 'd1', 'r2'];

function invalidResourceName(message) {
    const error = new Error(message);
    error.statusCode = 400;
    error.publicMessage = message;
    return error;
}

function validateResourceName(kind, name) {
    if (typeof name !== 'string' || name !== name.trim() || !name) {
        throw invalidResourceName('Resource name must be a non-empty string without surrounding whitespace');
    }
    if (kind === 'r2') {
        if (name.length < 3 || name.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(name)) {
            throw invalidResourceName('R2 bucket names must be 3-63 lowercase letters, numbers, or hyphens and cannot start or end with a hyphen');
        }
        return name;
    }
    if (name.length > 64 || /[\u0000-\u001f\u007f]/.test(name)) {
        throw invalidResourceName(`${kind.toUpperCase()} resource names must be 1-64 characters without control characters`);
    }
    return name;
}

function hydrate(row) {
    const payload = JSON.parse(row.payload);
    return { ...payload, id: row.id, name: row.name, created: payload.created || row.created_at };
}

function createResourceService(options = {}) {
    const db = options.db || getDatabase();
    const now = options.now || (() => new Date());
    const storage = options.storage || require('./resource-storage-service');
    const purging = new Set();

    function list(kind, includeDeleted = false) {
        if (!KINDS.includes(kind)) throw new Error(`Unsupported resource kind: ${kind}`);
        const sql = `SELECT * FROM resources WHERE kind = ?${includeDeleted ? '' : ' AND deleted_at IS NULL'} ORDER BY created_at, id`;
        return db.prepare(sql).all(kind).map(hydrate);
    }

    function getAll() {
        return { kv: list('kv'), d1: list('d1'), r2: list('r2') };
    }

    function getAllIncludingDeleted() {
        return { kv: list('kv', true), d1: list('d1', true), r2: list('r2', true) };
    }

    function create(kind, name, extra = {}) {
        if (!KINDS.includes(kind)) throw new Error(`Unsupported resource kind: ${kind}`);
        validateResourceName(kind, name);
        const id = `${kind}-${crypto.randomUUID()}`;
        const created = now().toISOString();
        const resource = { ...extra, id, name, created };
        try {
            db.prepare('INSERT INTO resources (id, kind, name, payload, created_at) VALUES (?, ?, ?, ?, ?)').run(id, kind, name, JSON.stringify(resource), created);
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                const existing = db.prepare('SELECT deleted_at FROM resources WHERE kind = ? AND name = ?').get(kind, name);
                error.statusCode = 409;
                error.publicMessage = existing && existing.deleted_at ? 'Resource name is reserved while the resource is in trash' : 'Duplicate name';
            }
            throw error;
        }
        return resource;
    }

    function rollbackCreate(kind, id) {
        if (!KINDS.includes(kind)) return false;
        return db.prepare(`DELETE FROM resources
            WHERE id = ? AND kind = ? AND deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM project_bindings WHERE resource_id = resources.id)`)
            .run(id, kind).changes > 0;
    }

    function softDelete(kind, id, actor = 'admin') {
        const timestamp = now();
        const deletedAt = timestamp.toISOString();
        const purgeAfter = new Date(timestamp.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        return db.transaction(() => {
            const resource = db.prepare('SELECT * FROM resources WHERE id = ? AND kind = ? AND deleted_at IS NULL').get(id, kind);
            if (!resource) return null;
            const affectedProjectIds = db.prepare('SELECT DISTINCT project_id FROM project_bindings WHERE resource_id = ? ORDER BY project_id')
                .all(id).map(row => row.project_id);
            db.prepare('DELETE FROM project_bindings WHERE resource_id = ?').run(id);
            db.prepare('UPDATE resources SET deleted_at = ?, purge_after = ? WHERE id = ?').run(deletedAt, purgeAfter, id);
            db.prepare('INSERT INTO audit_events (id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), 'resource.trash', 'resource', id, JSON.stringify({ actor, kind, name: resource.name, purgeAfter }), deletedAt);
            return { ...hydrate(resource), kind, deletedAt, purgeAfter, affectedProjectIds };
        })();
    }

    function listTrash() {
        return db.prepare('SELECT * FROM resources WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all().map(row => ({
            ...hydrate(row), kind: row.kind, deletedAt: row.deleted_at, purgeAfter: row.purge_after
        }));
    }

    function restore(id, actor = 'admin') {
        if (purging.has(id)) return null;
        const timestamp = now().toISOString();
        return db.transaction(() => {
            const row = db.prepare('SELECT * FROM resources WHERE id = ? AND deleted_at IS NOT NULL').get(id);
            if (!row) return null;
            const restoreAuditId = crypto.randomUUID();
            db.prepare('UPDATE resources SET deleted_at = NULL, purge_after = NULL WHERE id = ?').run(id);
            db.prepare('INSERT INTO audit_events (id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                .run(restoreAuditId, 'resource.restore', 'resource', id, JSON.stringify({ actor, kind: row.kind, name: row.name }), timestamp);
            return {
                ...hydrate(row),
                kind: row.kind,
                deletedAt: row.deleted_at,
                purgeAfter: row.purge_after,
                restoreAuditId
            };
        })();
    }

    function rollbackRestore(restored) {
        if (!restored?.id || !restored.deletedAt || !restored.purgeAfter) return false;
        return db.transaction(() => {
            const result = db.prepare(`UPDATE resources SET deleted_at = ?, purge_after = ?
                WHERE id = ? AND deleted_at IS NULL`)
                .run(restored.deletedAt, restored.purgeAfter, restored.id);
            if (result.changes === 0) return false;
            if (restored.restoreAuditId) {
                db.prepare(`DELETE FROM audit_events
                    WHERE id = ? AND action = 'resource.restore' AND entity_id = ?`)
                    .run(restored.restoreAuditId, restored.id);
            }
            return true;
        })();
    }

    async function purge(id, actor = 'admin', force = false) {
        const timestamp = now().toISOString();
        if (purging.has(id)) return null;
        const row = db.prepare('SELECT * FROM resources WHERE id = ? AND deleted_at IS NOT NULL').get(id);
        if (!row || (!force && row.purge_after > timestamp)) return null;
        purging.add(id);
        try {
            const resource = { ...hydrate(row), kind: row.kind };
            await storage.purge(resource);
            return db.transaction(() => {
                const current = db.prepare('SELECT * FROM resources WHERE id = ? AND deleted_at IS NOT NULL').get(id);
                if (!current) return null;
                db.prepare('DELETE FROM resources WHERE id = ?').run(id);
                db.prepare('INSERT INTO audit_events (id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(crypto.randomUUID(), 'resource.purge', 'resource', id, JSON.stringify({ actor, kind: current.kind, name: current.name }), timestamp);
                return { ...hydrate(current), kind: current.kind };
            })();
        } finally {
            purging.delete(id);
        }
    }

    async function purgeExpired() {
        const ids = db.prepare('SELECT id FROM resources WHERE deleted_at IS NOT NULL AND purge_after <= ?').all(now().toISOString());
        const purged = [];
        for (const { id } of ids) {
            const resource = await purge(id, 'system', true);
            if (resource) purged.push(resource);
        }
        return purged;
    }

    return {
        getAll,
        getAllIncludingDeleted,
        getKV: () => list('kv'),
        getD1: () => list('d1'),
        getR2: () => list('r2'),
        create,
        rollbackCreate,
        softDelete,
        listTrash,
        restore,
        rollbackRestore,
        purge,
        purgeExpired
    };
}

let singleton;
function service() {
    if (!singleton) singleton = createResourceService();
    return singleton;
}

module.exports = {
    createResourceService,
    validateResourceName,
    getAll: () => service().getAll(),
    getAllIncludingDeleted: () => service().getAllIncludingDeleted(),
    getKV: () => service().getKV(),
    getD1: () => service().getD1(),
    getR2: () => service().getR2(),
    create: (...args) => service().create(...args),
    rollbackCreate: (...args) => service().rollbackCreate(...args),
    softDelete: (...args) => service().softDelete(...args),
    listTrash: () => service().listTrash(),
    restore: (...args) => service().restore(...args),
    rollbackRestore: (...args) => service().rollbackRestore(...args),
    purge: (...args) => service().purge(...args),
    purgeExpired: () => service().purgeExpired()
};
