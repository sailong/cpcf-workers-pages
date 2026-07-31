'use strict';

const path = require('node:path');
const resourceRuntime = require('./resource-runtime');
const resourceService = require('./resource-service');
const { validateSQL } = require('../utils/d1-helper');

const DEFAULT_MIGRATIONS_TABLE = 'd1_migrations';
const MAX_MIGRATIONS = 1000;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

function leadingMigrationNumber(segment) {
    return Number.parseInt(segment.split('_')[0], 10);
}

function compareSegments(left, right) {
    const leftNumber = leadingMigrationNumber(left);
    const rightNumber = leadingMigrationNumber(right);
    if (leftNumber !== rightNumber) {
        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
        if (Number.isFinite(leftNumber)) return -1;
        if (Number.isFinite(rightNumber)) return 1;
    }
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function compareMigrationPaths(left, right) {
    const leftSegments = left.split('/');
    const rightSegments = right.split('/');
    const shared = Math.min(leftSegments.length, rightSegments.length);
    for (let index = 0; index < shared; index++) {
        const result = compareSegments(leftSegments[index], rightSegments[index]);
        if (result !== 0) return result;
    }
    return leftSegments.length - rightSegments.length;
}

function normalizeMigrationName(value) {
    if (typeof value !== 'string') throw Object.assign(new Error('Migration name is required'), { statusCode: 400 });
    const name = value.trim().replaceAll('\\', '/');
    const segments = name.split('/');
    if (!name || name.length > 512 || path.posix.isAbsolute(name)
        || segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('\0'))
        || !name.toLowerCase().endsWith('.sql')) {
        throw Object.assign(new Error(`Invalid migration name: ${value}`), { statusCode: 400 });
    }
    return name;
}

function normalizeMigrations(input) {
    if (!Array.isArray(input)) throw Object.assign(new Error('Migrations must be an array'), { statusCode: 400 });
    if (input.length > MAX_MIGRATIONS) {
        throw Object.assign(new Error(`At most ${MAX_MIGRATIONS} migrations can be applied at once`), { statusCode: 400 });
    }

    const names = new Set();
    let totalBytes = 0;
    const migrations = input.map(item => {
        if (!item || typeof item !== 'object') {
            throw Object.assign(new Error('Each migration must include a name and SQL content'), { statusCode: 400 });
        }
        const name = normalizeMigrationName(item.name);
        if (names.has(name)) throw Object.assign(new Error(`Duplicate migration name: ${name}`), { statusCode: 400 });
        names.add(name);

        const validation = validateSQL(item.sql);
        if (!validation.valid) throw Object.assign(new Error(`${name}: ${validation.error}`), { statusCode: 400 });
        totalBytes += Buffer.byteLength(item.sql, 'utf8');
        if (totalBytes > MAX_TOTAL_BYTES) {
            throw Object.assign(new Error('Migration payload cannot exceed 10 MiB'), { statusCode: 400 });
        }
        return { name, sql: item.sql };
    });
    return migrations.sort((left, right) => compareMigrationPaths(left.name, right.name));
}

function escapeIdentifier(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeString(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
}

function hydrateMigration(row) {
    return {
        id: row.id,
        name: row.name,
        appliedAt: row.applied_at
    };
}

function createD1MigrationService(options = {}) {
    const runtime = options.resourceRuntime || resourceRuntime;
    const resources = options.resourceService || resourceService;
    const migrationsTable = options.migrationsTable || DEFAULT_MIGRATIONS_TABLE;
    const locks = new Map();
    const escapedTable = escapeIdentifier(migrationsTable);
    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${escapedTable}(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`;
    const listSQL = `SELECT id, name, applied_at FROM ${escapedTable} ORDER BY id`;

    function assertDatabase(databaseId) {
        if (!resources.getD1().some(database => database.id === databaseId)) {
            throw Object.assign(new Error('D1 database not found'), { statusCode: 404 });
        }
    }

    async function withLock(databaseId, operation) {
        const previous = locks.get(databaseId) || Promise.resolve();
        const current = previous.catch(() => {}).then(operation);
        locks.set(databaseId, current);
        try {
            return await current;
        } finally {
            if (locks.get(databaseId) === current) locks.delete(databaseId);
        }
    }

    async function readApplied(database) {
        await database.prepare(createTableSQL).run();
        const result = await database.prepare(listSQL).all();
        return (result.results || []).map(hydrateMigration);
    }

    async function list(databaseId) {
        assertDatabase(databaseId);
        return runtime.withResource('d1', databaseId, async database => ({
            table: migrationsTable,
            applied: await readApplied(database)
        }));
    }

    async function apply(databaseId, input) {
        assertDatabase(databaseId);
        const migrations = normalizeMigrations(input);
        return withLock(databaseId, () => runtime.withResource('d1', databaseId, async database => {
            const before = await readApplied(database);
            const appliedNames = new Set(before.map(migration => migration.name));
            const applied = [];
            const skipped = [];

            for (const migration of migrations) {
                if (appliedNames.has(migration.name)) {
                    skipped.push(migration.name);
                    continue;
                }
                const query = `${migration.sql}\nINSERT INTO ${escapedTable} (name) VALUES (${escapeString(migration.name)});`;
                try {
                    await database.exec(query);
                } catch (cause) {
                    const error = new Error(`Migration ${migration.name} failed: ${cause.message}`);
                    error.statusCode = 422;
                    error.migrationName = migration.name;
                    throw error;
                }
                applied.push(migration.name);
                appliedNames.add(migration.name);
            }

            return {
                table: migrationsTable,
                applied,
                skipped,
                migrations: await readApplied(database)
            };
        }));
    }

    return { apply, list };
}

const service = createD1MigrationService();

module.exports = service;
module.exports.createD1MigrationService = createD1MigrationService;
module.exports.compareMigrationPaths = compareMigrationPaths;
module.exports.normalizeMigrations = normalizeMigrations;
