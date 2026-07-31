'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const SCHEMA_VERSION = 5;
const IMPORT_SETTING = 'legacy_json_import_v1';

function readLegacyJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value;
}

function ensureReadOnlyBackup(file) {
    if (!fs.existsSync(file)) return null;
    const backup = `${file}.pre-sqlite-backup`;
    const source = fs.readFileSync(file);
    if (fs.existsSync(backup)) {
        const existing = fs.readFileSync(backup);
        if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(source).digest(), crypto.createHash('sha256').update(existing).digest())) {
            throw new Error(`Legacy backup does not match source: ${backup}`);
        }
    } else {
        fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    }
    fs.chmodSync(backup, 0o444);
    return backup;
}

function applyMigrations(db) {
    const version = db.pragma('user_version', { simple: true });
    if (version > SCHEMA_VERSION) throw new Error(`Control-plane database version ${version} is newer than supported version ${SCHEMA_VERSION}`);
    if (version < 1) {
        db.transaction(() => {
            db.exec(`
                CREATE TABLE projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('worker', 'pages')),
                    port INTEGER,
                    status TEXT NOT NULL DEFAULT 'stopped',
                    main_file TEXT,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(name, type)
                );
                CREATE TABLE resources (
                    id TEXT PRIMARY KEY,
                    kind TEXT NOT NULL CHECK(kind IN ('kv', 'd1', 'r2')),
                    name TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    deleted_at TEXT,
                    purge_after TEXT,
                    UNIQUE(kind, name)
                );
                CREATE TABLE project_bindings (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
                    kind TEXT NOT NULL CHECK(kind IN ('kv', 'd1', 'r2')),
                    var_name TEXT NOT NULL,
                    UNIQUE(project_id, kind, var_name)
                );
                CREATE INDEX project_bindings_resource_idx ON project_bindings(resource_id);
                CREATE TABLE deployments (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    payload TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE sessions (
                    token_hash TEXT PRIMARY KEY,
                    expires_at INTEGER NOT NULL,
                    version INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE audit_events (
                    id TEXT PRIMARY KEY,
                    action TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT,
                    details TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                PRAGMA user_version = 1;
            `);
        })();
    }
    if (version < 2) {
        db.transaction(() => {
            db.exec(`
                CREATE TABLE releases (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    checksum TEXT NOT NULL,
                    entry_path TEXT NOT NULL,
                    payload TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    activated_at TEXT
                );
                CREATE INDEX releases_project_created_idx ON releases(project_id, created_at DESC);
                ALTER TABLE projects ADD COLUMN active_release_id TEXT REFERENCES releases(id);
                PRAGMA user_version = 2;
            `);
        })();
    }
    if (version < 3) {
        db.transaction(() => {
            db.exec(`
                CREATE TABLE operations (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    status TEXT NOT NULL,
                    payload TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                );
                CREATE INDEX operations_project_created_idx ON operations(project_id, created_at DESC);
                INSERT INTO operations (id, project_id, status, payload, created_at)
                    SELECT id, project_id, status, payload, created_at
                    FROM deployments
                    WHERE id LIKE 'deployment-%';
                DELETE FROM deployments WHERE id LIKE 'deployment-%';
                PRAGMA user_version = 3;
            `);
        })();
    }
    if (version < 4) {
        db.transaction(() => {
            db.exec(`
                CREATE TABLE runtime_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    stream TEXT NOT NULL CHECK(stream IN ('stdout', 'stderr', 'system')),
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX runtime_logs_project_id_idx ON runtime_logs(project_id, id DESC);
                PRAGMA user_version = 4;
            `);
        })();
    }
    if (version < 5) {
        db.transaction(() => {
            db.exec(`
                UPDATE projects
                SET port = NULL
                WHERE port IS NOT NULL
                  AND id NOT IN (
                      SELECT MIN(id) FROM projects WHERE port IS NOT NULL GROUP BY port
                  );
                CREATE UNIQUE INDEX IF NOT EXISTS projects_port_unique_idx ON projects(port) WHERE port IS NOT NULL;
                PRAGMA user_version = 5;
            `);
        })();
    }
}

function normalizeBindings(bindings) {
    const rows = [];
    for (const kind of ['kv', 'd1', 'r2']) {
        for (const binding of (bindings && bindings[kind]) || []) {
            if (binding && binding.varName && binding.resourceId) rows.push({ kind, ...binding });
        }
    }
    return rows;
}

function validateLegacyData(projects, resources) {
    if (!Array.isArray(projects)) throw new Error('Legacy projects JSON must be an array');
    for (const kind of ['kv', 'd1', 'r2']) {
        if (!Array.isArray(resources[kind])) throw new Error(`Legacy resources.${kind} must be an array`);
    }

    const projectIds = new Set();
    const projectNames = new Set();
    for (const project of projects) {
        if (!project || !project.id || !project.name || !project.type) {
            throw new Error('Legacy project is missing id, name, or type');
        }
        if (!['worker', 'pages'].includes(project.type)) throw new Error(`Legacy project has invalid type: ${project.type}`);
        if (projectIds.has(project.id)) throw new Error(`Duplicate legacy project id: ${project.id}`);
        const nameKey = `${project.type}\0${project.name}`;
        if (projectNames.has(nameKey)) throw new Error(`Duplicate legacy project name and type: ${project.name}`);
        projectIds.add(project.id);
        projectNames.add(nameKey);
    }

    const resourceKindsById = new Map();
    const resourceNames = new Set();
    for (const kind of ['kv', 'd1', 'r2']) {
        for (const resource of resources[kind]) {
            if (!resource || !resource.id || !resource.name) throw new Error(`Legacy ${kind} resource is missing id or name`);
            if (resourceKindsById.has(resource.id)) throw new Error(`Duplicate legacy resource id: ${resource.id}`);
            const nameKey = `${kind}\0${resource.name}`;
            if (resourceNames.has(nameKey)) throw new Error(`Duplicate legacy ${kind} resource name: ${resource.name}`);
            resourceKindsById.set(resource.id, kind);
            resourceNames.add(nameKey);
        }
    }

    for (const project of projects) {
        const bindingNames = new Set();
        for (const binding of normalizeBindings(project.bindings)) {
            const resourceKind = resourceKindsById.get(binding.resourceId);
            if (!resourceKind) throw new Error(`Legacy binding references missing resource: ${binding.resourceId}`);
            if (resourceKind !== binding.kind) throw new Error(`Legacy binding kind mismatch for resource: ${binding.resourceId}`);
            const bindingKey = `${binding.kind}\0${binding.varName}`;
            if (bindingNames.has(bindingKey)) throw new Error(`Duplicate legacy binding name: ${binding.varName}`);
            bindingNames.add(bindingKey);
        }
    }
}

function importLegacyJson(db, options) {
    if (db.prepare('SELECT 1 FROM settings WHERE key = ?').get(IMPORT_SETTING)) return;
    const projects = readLegacyJson(options.projectsFile, []);
    const resources = readLegacyJson(options.resourcesFile, { kv: [], d1: [], r2: [] });
    validateLegacyData(projects, resources);
    ensureReadOnlyBackup(options.projectsFile);
    ensureReadOnlyBackup(options.resourcesFile);

    const insertProject = db.prepare('INSERT INTO projects (id, name, type, port, status, main_file, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertResource = db.prepare('INSERT INTO resources (id, kind, name, payload, created_at) VALUES (?, ?, ?, ?, ?)');
    const insertBinding = db.prepare('INSERT INTO project_bindings (id, project_id, resource_id, kind, var_name) VALUES (?, ?, ?, ?, ?)');
    const setSetting = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
    db.transaction(() => {
        for (const project of projects) {
            if (!project || !project.id || !project.name || !project.type) throw new Error('Legacy project is missing id, name, or type');
            const createdAt = project.createdAt || new Date().toISOString();
            insertProject.run(project.id, project.name, project.type, project.port || null, project.status || 'stopped', project.mainFile || null, JSON.stringify(project), createdAt);
        }
        for (const kind of ['kv', 'd1', 'r2']) {
            for (const resource of resources[kind]) {
                if (!resource || !resource.id || !resource.name) throw new Error(`Legacy ${kind} resource is missing id or name`);
                insertResource.run(resource.id, kind, resource.name, JSON.stringify(resource), resource.created || resource.createdAt || new Date().toISOString());
            }
        }
        for (const project of projects) {
            for (const binding of normalizeBindings(project.bindings)) {
                insertBinding.run(crypto.randomUUID(), project.id, binding.resourceId, binding.kind, binding.varName);
            }
        }
        setSetting.run(IMPORT_SETTING, JSON.stringify({ completedAt: new Date().toISOString() }), new Date().toISOString());
    })();
}

function createDatabase(options = {}) {
    const databaseFile = options.databaseFile || config.DATABASE_FILE;
    const databaseDirectory = path.dirname(databaseFile);
    fs.mkdirSync(databaseDirectory, { recursive: true, mode: 0o700 });
    const db = new Database(databaseFile);
    try {
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.pragma('busy_timeout = 5000');
        applyMigrations(db);
        importLegacyJson(db, {
            projectsFile: options.projectsFile || config.PROJECTS_FILE,
            resourcesFile: options.resourcesFile || config.RESOURCES_FILE
        });
        return db;
    } catch (error) {
        db.close();
        throw error;
    }
}

let singleton;
function getDatabase() {
    if (!singleton) singleton = createDatabase();
    return singleton;
}

module.exports = { SCHEMA_VERSION, createDatabase, getDatabase, validateLegacyData };
