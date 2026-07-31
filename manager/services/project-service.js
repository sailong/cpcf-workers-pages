'use strict';

const crypto = require('crypto');
const net = require('net');
const { getDatabase } = require('./database');
const { normalizeProjectLimits } = require('./project-limits');
const { normalizeProjectCompatibility } = require('./project-compatibility');
const { validateProjectName } = require('../utils/project-hostname');

function createProjectService(options = {}) {
    const db = options.db || getDatabase();

    function portConflict(port, projectName) {
        const error = new Error(`Port ${port} is already assigned to project "${projectName || 'another project'}"`);
        error.statusCode = 409;
        error.publicMessage = error.message;
        return error;
    }

    function markPortConstraint(error, port) {
        if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' && /projects\.port|projects_port_unique_idx/i.test(error.message || '')) {
            const conflict = db.prepare('SELECT name FROM projects WHERE port = ? LIMIT 1').get(port);
            throw portConflict(port, conflict?.name);
        }
        throw error;
    }

    function hydrate(row) {
        const project = { ...JSON.parse(row.payload), id: row.id, name: row.name, type: row.type, port: row.port, status: row.status, mainFile: row.main_file, activeReleaseId: row.active_release_id || null, createdAt: row.created_at };
        const bindings = { kv: [], d1: [], r2: [] };
        for (const binding of db.prepare('SELECT kind, var_name, resource_id FROM project_bindings WHERE project_id = ? ORDER BY kind, var_name').all(row.id)) {
            bindings[binding.kind].push({ varName: binding.var_name, resourceId: binding.resource_id });
        }
        project.bindings = bindings;
        project.limits = normalizeProjectLimits(project.limits || {});
        Object.assign(project, normalizeProjectCompatibility(project));
        return project;
    }

    function getAll() {
        return db.prepare('SELECT * FROM projects ORDER BY created_at, id').all().map(hydrate);
    }

    function getById(id) {
        const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        return row ? hydrate(row) : undefined;
    }

    function validateBindings(bindings) {
        const normalized = { kv: [], d1: [], r2: [] };
        const names = new Set();
        for (const kind of ['kv', 'd1', 'r2']) {
            const entries = bindings?.[kind] || [];
            if (!Array.isArray(entries) || entries.length > 100) {
                const error = new Error(`${kind.toUpperCase()} bindings must be an array with at most 100 entries`);
                error.statusCode = 400;
                throw error;
            }
            for (const binding of entries) {
                if (!binding || typeof binding.varName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(binding.varName)) {
                    const error = new Error('Binding names must be valid JavaScript identifiers');
                    error.statusCode = 400;
                    throw error;
                }
                if (names.has(binding.varName)) {
                    const error = new Error(`Duplicate binding name: ${binding.varName}`);
                    error.statusCode = 400;
                    throw error;
                }
                names.add(binding.varName);
                const resource = db.prepare('SELECT kind, deleted_at FROM resources WHERE id = ?').get(binding.resourceId);
                if (!resource || resource.kind !== kind || resource.deleted_at) {
                    const error = new Error(`${kind.toUpperCase()} binding ${binding.varName} references an unavailable or mismatched resource`);
                    error.statusCode = 400;
                    throw error;
                }
                normalized[kind].push({ varName: binding.varName, resourceId: binding.resourceId });
            }
        }
        return normalized;
    }

    function writeBindings(projectId, bindings) {
        bindings = validateBindings(bindings);
        const insert = db.prepare('INSERT INTO project_bindings (id, project_id, resource_id, kind, var_name) VALUES (?, ?, ?, ?, ?)');
        for (const kind of ['kv', 'd1', 'r2']) {
            for (const binding of (bindings && bindings[kind]) || []) {
                insert.run(crypto.randomUUID(), projectId, binding.resourceId, kind, binding.varName);
            }
        }
    }

    function add(project) {
        validateProjectName(project.name, project.type);
        project = {
            ...project,
            ...normalizeProjectCompatibility(project),
            bindings: validateBindings(project.bindings),
            limits: normalizeProjectLimits(project.limits || {})
        };
        try {
            db.transaction(() => {
                const conflict = db.prepare('SELECT id FROM projects WHERE lower(name) = lower(?) AND type = ?').get(project.name, project.type);
                if (conflict) {
                    const error = new Error(`A ${project.type} project named "${project.name}" already exists`);
                    error.statusCode = 409;
                    throw error;
                }
                if (project.port !== undefined && project.port !== null) {
                    const portOwner = db.prepare('SELECT name FROM projects WHERE port = ? LIMIT 1').get(project.port);
                    if (portOwner) throw portConflict(project.port, portOwner.name);
                }
                db.prepare('INSERT INTO projects (id, name, type, port, status, main_file, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                    .run(project.id, project.name, project.type, project.port || null, project.status || 'stopped', project.mainFile || null, JSON.stringify(project), project.createdAt || new Date().toISOString());
                writeBindings(project.id, project.bindings);
            })();
        } catch (error) {
            markPortConstraint(error, project.port);
        }
        return getById(project.id);
    }

    function update(id, changes) {
        return db.transaction(() => {
            const current = getById(id);
            if (!current) return undefined;
            const next = { ...current, ...changes, id: current.id, name: changes.name || current.name, type: changes.type || current.type };
            validateProjectName(next.name, next.type);
            const conflict = db.prepare('SELECT id FROM projects WHERE lower(name) = lower(?) AND type = ? AND id <> ?')
                .get(next.name, next.type, id);
            if (conflict) {
                const error = new Error(`A ${next.type} project named "${next.name}" already exists`);
                error.statusCode = 409;
                throw error;
            }
            if (Object.prototype.hasOwnProperty.call(changes, 'bindings')) next.bindings = validateBindings(changes.bindings);
            next.limits = normalizeProjectLimits(next.limits || {});
            Object.assign(next, normalizeProjectCompatibility(next));
            try {
                db.prepare('UPDATE projects SET name = ?, type = ?, port = ?, status = ?, main_file = ?, payload = ? WHERE id = ?')
                    .run(next.name, next.type, next.port || null, next.status || 'stopped', next.mainFile || null, JSON.stringify(next), id);
            } catch (error) {
                markPortConstraint(error, next.port);
            }
            if (Object.prototype.hasOwnProperty.call(changes, 'bindings')) {
                db.prepare('DELETE FROM project_bindings WHERE project_id = ?').run(id);
                writeBindings(id, next.bindings);
            }
            return getById(id);
        })();
    }

    function remove(id) {
        return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
    }

    function isSystemPortInUse(port) {
        return new Promise(resolve => {
            const server = net.createServer();
            server.once('error', () => resolve(true));
            server.once('listening', () => server.close(() => resolve(false)));
            server.listen(port);
        });
    }

    async function isPortAvailable(port, excludeProjectId = null) {
        if (port < 1024 || port > 65535) return { valid: false, error: '端口必须在 1024-65535 范围内' };
        const existingProject = getAll().find(project => project.port === port && project.id !== excludeProjectId);
        if (existingProject) return { valid: false, error: `端口 ${port} 已被项目 "${existingProject.name}" 占用` };
        if (await isSystemPortInUse(port)) return { valid: false, error: `端口 ${port} 已被系统进程或其他服务占用` };
        return { valid: true };
    }

    async function getAvailablePort(preferredPort = null) {
        if (preferredPort && (await isPortAvailable(preferredPort)).valid) return preferredPort;
        const startPort = parseInt(process.env.PORT_RANGE_START || 10000);
        const endPort = parseInt(process.env.PORT_RANGE_END || 20000);
        for (let port = startPort; port <= endPort; port++) {
            if ((await isPortAvailable(port)).valid) return port;
        }
        throw new Error('没有可用端口');
    }

    return { getAll, getById, add, update, remove, validateBindings, isPortAvailable, getAvailablePort, isSystemPortInUse };
}

let singleton;
function service() {
    if (!singleton) singleton = createProjectService();
    return singleton;
}

module.exports = {
    createProjectService,
    getAll: () => service().getAll(),
    getById: id => service().getById(id),
    add: project => service().add(project),
    update: (id, changes) => service().update(id, changes),
    remove: id => service().remove(id),
    validateBindings: bindings => service().validateBindings(bindings),
    isPortAvailable: (...args) => service().isPortAvailable(...args),
    getAvailablePort: (...args) => service().getAvailablePort(...args),
    isSystemPortInUse: (...args) => service().isSystemPortInUse(...args)
};
