const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const DATA_DIR = path.join(__dirname, '../../.platform-data');
const SHARED_STATE_DIR = path.join(DATA_DIR, 'wrangler-shared-state');
const MANAGER_CONFIG_PATH = path.join(DATA_DIR, 'manager-d1-config.toml');

// SQL 关键字黑名单（防止注入）
const SQL_KEYWORDS = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
    'UNION', 'JOIN', 'WHERE', 'FROM', 'INTO', 'SET', 'VALUES', 'AND', 'OR', 'NOT',
    'NULL', 'TRUE', 'FALSE', 'EXEC', 'EXECUTE', 'SCRIPT', 'DECLARE', 'CAST', 'CONVERT'
];

/**
 * 验证表名是否安全
 * @param {string} tableName - 要验证的表名
 * @returns {{ valid: boolean, error?: string, safeName?: string }}
 */
function validateTableName(tableName) {
    if (!tableName || typeof tableName !== 'string') {
        return { valid: false, error: '表名不能为空' };
    }

    // 去除首尾空格
    const trimmed = tableName.trim();

    // 长度限制
    if (trimmed.length > 128) {
        return { valid: false, error: '表名过长（最大 128 字符）' };
    }

    // 只允许字母、数字、下划线，且不能以数字开头
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validPattern.test(trimmed)) {
        return { valid: false, error: '表名只能包含字母、数字、下划线，且不能以数字开头' };
    }

    // 检查是否包含 SQL 关键字
    const upperName = trimmed.toUpperCase();
    if (SQL_KEYWORDS.includes(upperName)) {
        return { valid: false, error: `表名不能是 SQL 关键字: ${trimmed}` };
    }

    return { valid: true, safeName: trimmed };
}

/**
 * 验证 SQL 语句是否安全（基础检查）
 * @param {string} sql - SQL 语句
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSQL(sql) {
    if (!sql || typeof sql !== 'string') {
        return { valid: false, error: 'SQL 语句不能为空' };
    }

    // 检查危险的多语句执行
    const dangerousPatterns = [
        /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE)\s/i,  // 危险语句组合
        /--/,                                           // SQL 注释
        /\/\*/,                                         // 多行注释开始
        /\*\//,                                         // 多行注释结束
        /xp_/i,                                         // 扩展存储过程
        /sp_/i,                                         // 系统存储过程
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(sql)) {
            return { valid: false, error: `SQL 语句包含不允许的模式` };
        }
    }

    return { valid: true };
}

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
 * Execute SQL via Wrangler CLI (async, non-blocking)
 */
async function runWranglerSQL(dbId, sql) {
    const resourcesPath = path.join(DATA_DIR, 'resources.json');
    let dbName = 'unknown-db';
    if (fs.existsSync(resourcesPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'));
            const db = data.d1.find(d => d.id === dbId);
            if (db) dbName = db.name;
        } catch (e) { console.error("Error reading resources for name lookup", e); }
    }

    ensureConfig(dbId, dbName);

    const sqlFile = path.join(DATA_DIR, 'temp-query.sql');
    fs.writeFileSync(sqlFile, sql);

    try {
        const cmd = `npx wrangler d1 execute DB --local --config "${MANAGER_CONFIG_PATH}" --file "${sqlFile}" --persist-to "${SHARED_STATE_DIR}" --json`;
        const { stdout, stderr } = await execAsync(cmd, { 
            encoding: 'utf8',
            timeout: 30000 // 30 秒超时
        });

        const output = JSON.parse(stdout);

        if (Array.isArray(output) && output.length > 0) {
            return output[0];
        }
        return { success: true, results: [] };

    } catch (e) {
        console.error("Wrangler Exec Error:", e.stderr || e.message);
        throw new Error(`D1 Execution Failed: ${e.message}`);
    }
}

/**
 * Execute SQL and return results
 */
async function executeSQL(dbId, sql) {
    const raw = await runWranglerSQL(dbId, sql);
    
    if (raw.results) {
        if (raw.results.length > 0) {
            const columns = Object.keys(raw.results[0]);
            const rows = raw.results.map(row => Object.values(row));
            return { columns, rows };
        } else {
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return { columns: [], rows: [] };
            }
        }
    }

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
 */
async function listTables(dbId) {
    const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;";
    const raw = await runWranglerSQL(dbId, sql);
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
    // 安全验证表名
    const validation = validateTableName(tableName);
    if (!validation.valid) {
        throw new Error(`无效的表名: ${validation.error}`);
    }

    // 限制 limit 范围
    const safeLimit = Math.max(1, Math.min(10000, parseInt(limit) || 100));

    const sql = `SELECT * FROM "${validation.safeName}" LIMIT ${safeLimit};`;
    return executeSQL(dbId, sql);
}

/**
 * Get table structure (schema)
 * @param {string} dbId 
 * @param {string} tableName 
 * @returns {Array} - List of columns
 */
function getTableStructure(dbId, tableName) {
    // 安全验证表名
    const validation = validateTableName(tableName);
    if (!validation.valid) {
        throw new Error(`无效的表名: ${validation.error}`);
    }

    const sql = `PRAGMA table_info("${validation.safeName}");`;
    const res = runWranglerSQL(dbId, sql);
    return res.results || [];
}

module.exports = {
    executeSQL,
    listTables,
    queryTable,
    getTableStructure,
    validateTableName,
    validateSQL
};
