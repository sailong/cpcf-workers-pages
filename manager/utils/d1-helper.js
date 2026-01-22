const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../../.platform-data');
const SHARED_STATE_DIR = path.join(DATA_DIR, 'wrangler-shared-state');
const MANAGER_CONFIG_PATH = path.join(DATA_DIR, 'manager-d1-config.toml');

/**
 * Ensures the manager config exists with the target binding
 * @param {string} dbId 
 * @param {string} dbName 
 */
function ensureConfig(dbId, dbName) {
    // We generate a simple wrangler.toml for the manager to use
    // It maps the requested database to a binding named "DB"
    const configContent = `
name = "manager-d1-client"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "${dbName}"
database_id = "${dbId}"
preview_database_id = "${dbId}"
`;
    fs.writeFileSync(MANAGER_CONFIG_PATH, configContent);
}

/**
 * Execute SQL via Wrangler CLI to ensure we hit the same DB as the workers
 * @param {string} dbId 
 * @param {string} sql 
 */
function runWranglerSQL(dbId, sql) {
    // 1. Get DB Name from resources.json (we need name for config)
    // Since we don't have easy access to resources array here without circular dep,
    // We'll peek at resources.json directly.
    const resourcesPath = path.join(DATA_DIR, 'resources.json');
    let dbName = 'unknown-db';
    if (fs.existsSync(resourcesPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'));
            const db = data.d1.find(d => d.id === dbId);
            if (db) dbName = db.name;
        } catch (e) { console.error("Error reading resources for name lookup", e); }
    }

    // 2. Refresh Config
    ensureConfig(dbId, dbName);

    // 3. Run Exec
    // wrangler d1 execute DB --local --config ... --command ... --persist-to ...

    // Escape SQL for shell (rudimentary)
    // Better: write SQL to file
    const sqlFile = path.join(DATA_DIR, 'temp-query.sql');
    fs.writeFileSync(sqlFile, sql);

    try {
        const cmd = `npx wrangler d1 execute DB --local --config "${MANAGER_CONFIG_PATH}" --file "${sqlFile}" --persist-to "${SHARED_STATE_DIR}" --json`;
        // console.log("Executing D1:", cmd); 
        const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

        // Wrangler returns an array of results (one per statement)
        // [ { success: true, meta: {...}, results: [...] } ]
        const output = JSON.parse(stdout);

        if (Array.isArray(output) && output.length > 0) {
            return output[0]; // Return first statement result
        }
        return { success: true, results: [] };

    } catch (e) {
        console.error("Wrangler Exec Error:", e.stderr || e.message);
        // Try to parse stdout even if error code, sometimes it returns error JSON
        try {
            if (e.stdout) {
                // Wrangler sometimes outputs text before JSON?
                // Let's assume standard JSON output on error? No, typically text.
                // We construct an error object.
            }
        } catch (subE) { }

        throw new Error(`D1 Execution Failed: ${e.message}`);
    }
}

/**
 * Execute SQL and return results (Adapter for old API)
 * @param {string} dbId - Database ID
 * @param {string} sql - SQL statement to execute
 * @returns {Object} - Results in wrangler-compatible format
 */
function executeSQL(dbId, sql) {
    const raw = runWranglerSQL(dbId, sql);
    // Transform if needed? 
    // Wrangler JSON output: 
    // { success: true, meta: { served_by: '...', duration: ... }, results: [ ... ] }
    // Our frontend expects: { rows: [...], columns: [...] } or { success: true, meta: ... } depending on usage.

    // Actually, looking at old code:
    // SELECT: returns { columns: [...], rows: [...] }
    // EXEC: returns { success: true, meta: { changes, last_row_id } }

    // Wrangler output for SELECT:
    // "results": [ { "id": 1, "name": "foo" } ]

    if (raw.results) {
        // It's a query result (or empty)
        if (raw.results.length > 0) {
            const columns = Object.keys(raw.results[0]);
            const rows = raw.results.map(row => Object.values(row));
            return { columns, rows };
        } else {
            // Empty results -> could be empty SELECT or an INSERT
            // Check meta?
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return { columns: [], rows: [] };
            }
        }
    }

    // Fallback / INSERT response
    return {
        success: true,
        meta: {
            changes: raw.meta?.changes || 0,
            last_row_id: raw.meta?.last_row_id || 0
        }
    };
}

/**
 * List tables in the database
 * @param {string} dbId - Database ID
 * @returns {Array} - List of table objects
 */
function listTables(dbId) {
    const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;";
    const res = executeSQL(dbId, sql);

    // Old code returned: [ { name: 'users' }, ... ] (from better-sqlite3 stmt.all())
    // New executeSQL returns: { columns: ['name'], rows: [['users']] } via the mapping above
    // We need to unwrap it to match old signature?
    // Wait, old `listTables` returned `stmt.all()` which is array of objects.
    // So executeSQL transformation above might be too aggressive if we want to reuse internal logic?
    // Let's manually run query here to match return type.

    const raw = runWranglerSQL(dbId, sql);
    return raw.results || [];
}

/**
 * Query table data
 * @param {string} dbId - Database ID
 * @param {string} tableName - Table name
 * @param {number} limit - Row limit
 * @returns {Object} - Table data
 */
function queryTable(dbId, tableName, limit = 100) {
    const sql = `SELECT * FROM ${tableName} LIMIT ${limit};`;
    return executeSQL(dbId, sql);
}

/**
 * Get table structure (schema)
 * @param {string} dbId 
 * @param {string} tableName 
 * @returns {Array} - List of columns
 */
function getTableStructure(dbId, tableName) {
    // Sanitize tableName (basic alphanumeric + underscore) to prevent accidental injection if passed directly
    // forcing it to string
    const safeTable = String(tableName).replace(/[^a-zA-Z0-9_]/g, '');
    const sql = `PRAGMA table_info('${safeTable}');`;
    const res = runWranglerSQL(dbId, sql);
    return res.results || [];
}

module.exports = {
    executeSQL,
    listTables,
    queryTable,
    getTableStructure
};
