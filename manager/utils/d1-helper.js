'use strict';

const resourceRuntime = require('../services/resource-runtime');
const resourceService = require('../services/resource-service');
const { unstable_splitSqlQuery: splitSqlQuery } = require('wrangler');

const SQL_KEYWORDS = new Set([
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
    'UNION', 'JOIN', 'WHERE', 'FROM', 'INTO', 'SET', 'VALUES', 'AND', 'OR', 'NOT',
    'NULL', 'TRUE', 'FALSE', 'EXEC', 'EXECUTE', 'SCRIPT', 'DECLARE', 'CAST', 'CONVERT'
]);

function validateTableName(tableName) {
    if (!tableName || typeof tableName !== 'string') return { valid: false, error: '表名不能为空' };
    const trimmed = tableName.trim();
    if (trimmed.length > 128) return { valid: false, error: '表名过长（最大 128 字符）' };
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
        return { valid: false, error: '表名只能包含字母、数字、下划线，且不能以数字开头' };
    }
    if (SQL_KEYWORDS.has(trimmed.toUpperCase())) return { valid: false, error: `表名不能是 SQL 关键字: ${trimmed}` };
    return { valid: true, safeName: trimmed };
}

function validateSQL(sql) {
    if (!sql || typeof sql !== 'string') return { valid: false, error: 'SQL 语句不能为空' };
    if (Buffer.byteLength(sql, 'utf8') > 1024 * 1024) return { valid: false, error: 'SQL 语句不能超过 1 MiB' };
    return { valid: true };
}

function assertDatabase(dbId) {
    if (!resourceService.getD1().some(database => database.id === dbId)) {
        const error = new Error('D1 database not found');
        error.statusCode = 404;
        throw error;
    }
}

function toConsoleResult(result, statement) {
    const rows = result.results || [];
    const returnsRows = /^\s*(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(statement);
    if (returnsRows || rows.length > 0) {
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { columns, rows: rows.map(row => columns.map(column => row[column])) };
    }
    return {
        success: result.success !== false,
        meta: {
            changes: result.meta?.changes || 0,
            last_row_id: result.meta?.last_row_id || 0,
            duration: result.meta?.duration
        }
    };
}

async function runStatements(dbId, sql) {
    assertDatabase(dbId);
    const validation = validateSQL(sql);
    if (!validation.valid) throw new Error(validation.error);
    const statements = splitSqlQuery(sql).map(statement => statement.trim()).filter(Boolean);
    if (statements.length === 0) throw new Error('SQL 语句不能为空');
    return resourceRuntime.withResource('d1', dbId, async database => {
        const results = [];
        for (const statement of statements) results.push(await database.prepare(statement).all());
        return { statements, results };
    });
}

async function executeSQL(dbId, sql) {
    const { statements, results } = await runStatements(dbId, sql);
    return toConsoleResult(results[results.length - 1], statements[statements.length - 1]);
}

async function listTables(dbId) {
    const { results } = await runStatements(dbId,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;");
    return results[0].results || [];
}

async function queryTable(dbId, tableName, limit = 100) {
    const validation = validateTableName(tableName);
    if (!validation.valid) throw new Error(`无效的表名: ${validation.error}`);
    const safeLimit = Math.max(1, Math.min(10000, Number.parseInt(limit, 10) || 100));
    return executeSQL(dbId, `SELECT * FROM "${validation.safeName}" LIMIT ${safeLimit};`);
}

async function getTableStructure(dbId, tableName) {
    const validation = validateTableName(tableName);
    if (!validation.valid) throw new Error(`无效的表名: ${validation.error}`);
    const { results } = await runStatements(dbId, `PRAGMA table_info("${validation.safeName}");`);
    return results[0].results || [];
}

module.exports = {
    executeSQL,
    listTables,
    queryTable,
    getTableStructure,
    validateTableName,
    validateSQL
};
