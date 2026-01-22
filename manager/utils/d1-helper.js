const path = require('path');
const Database = require('better-sqlite3');

const D1_DIR = path.join(__dirname, '../../.platform-data/d1-databases');

/**
 * Get a D1 database connection
 * @param {string} dbId - Database ID
 * @returns {Database} - SQLite database instance
 */
function getDatabase(dbId) {
    const dbPath = path.join(D1_DIR, `${dbId}.db`);
    return new Database(dbPath);
}

/**
 * Execute SQL and return results
 * @param {string} dbId - Database ID
 * @param {string} sql - SQL statement to execute
 * @returns {Object} - Results in wrangler-compatible format
 */
function executeSQL(dbId, sql) {
    const db = getDatabase(dbId);

    try {
        const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

        if (isSelect) {
            const stmt = db.prepare(sql);
            const rows = stmt.all();

            if (rows.length > 0) {
                return {
                    columns: Object.keys(rows[0]),
                    rows: rows.map(row => Object.values(row))
                };
            } else {
                return { columns: [], rows: [] };
            }
        } else {
            const stmt = db.prepare(sql);
            const info = stmt.run();
            return {
                success: true,
                meta: {
                    changes: info.changes,
                    last_row_id: info.lastInsertRowid
                }
            };
        }
    } finally {
        db.close();
    }
}

/**
 * List tables in the database
 * @param {string} dbId - Database ID
 * @returns {Array} - List of table objects
 */
function listTables(dbId) {
    const db = getDatabase(dbId);

    try {
        const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;";
        const stmt = db.prepare(sql);
        return stmt.all();
    } finally {
        db.close();
    }
}

/**
 * Query table data
 * @param {string} dbId - Database ID
 * @param {string} tableName - Table name
 * @param {number} limit - Row limit
 * @returns {Object} - Table data
 */
function queryTable(dbId, tableName, limit = 100) {
    const db = getDatabase(dbId);

    try {
        const sql = `SELECT * FROM ${tableName} LIMIT ${limit};`;
        const stmt = db.prepare(sql);
        const rows = stmt.all();

        return {
            columns: rows.length > 0 ? Object.keys(rows[0]) : [],
            rows: rows.map(row => Object.values(row))
        };
    } finally {
        db.close();
    }
}

module.exports = {
    executeSQL,
    listTables,
    queryTable
};
