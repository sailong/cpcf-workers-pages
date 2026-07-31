const express = require('express');
const router = express.Router();
const resourceService = require('../services/resource-service');
const runtimeService = require('../services/runtime-service');
const d1Helper = require('../utils/d1-helper');
const d1Migrations = require('../services/d1-migration-service');
const auditService = require('../services/audit-service');
const { errorStatus } = require('../utils/http-error');

// Get D1
router.get('/', (req, res) => res.json(resourceService.getD1()));

// Create D1
router.post('/', async (req, res, next) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    let newDB;
    try {
        newDB = resourceService.create('d1', name);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.publicMessage || error.message });
    }

    // Config will be lazily created on first access via d1Helper

    try {
        await runtimeService.updateResources();
        auditService.record('resource.create', 'resource', newDB.id, { kind: 'd1', name: newDB.name });
        res.json(newDB);
    } catch (error) {
        resourceService.rollbackCreate('d1', newDB.id);
        await runtimeService.updateResources().catch(() => {});
        next(error);
    }
});

// Delete D1
router.delete('/:id', async (req, res, next) => {
    const { id } = req.params;
    const deleted = resourceService.softDelete('d1', id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    try {
        const runtime = await runtimeService.reconcileResourceDeletion(deleted);
        res.json({ success: true, id, purgeAfter: deleted.purgeAfter, runtime });
    } catch (error) {
        next(error);
    }
});

// Execute SQL
router.post('/:id/execute', async (req, res) => {
    const { id } = req.params;
    const { sql } = req.body;

    if (!sql) return res.status(400).json({ error: "SQL is required" });
    const dbMeta = resourceService.getD1().find(d => d.id === id);
    if (!dbMeta) return res.status(404).json({ error: "Database not found" });

    try {
        const result = await d1Helper.executeSQL(id, sql);
        res.json(result);
    } catch (error) {
        res.status(errorStatus(error)).json({ error: error.message });
    }
});

router.get('/:id/migrations', async (req, res) => {
    try {
        res.json(await d1Migrations.list(req.params.id));
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

router.post('/:id/migrations/apply', async (req, res) => {
    try {
        const result = await d1Migrations.apply(req.params.id, req.body.migrations);
        auditService.record('d1.migrations.apply', 'resource', req.params.id, {
            names: result.applied,
            appliedCount: result.applied.length,
            skippedCount: result.skipped.length
        });
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message, migrationName: error.migrationName });
    }
});

// List Tables
router.get('/:id/tables', async (req, res) => {
    const { id } = req.params;
    const dbMeta = resourceService.getD1().find(d => d.id === id);
    if (!dbMeta) return res.status(404).json({ error: "Database not found" });

    try {
        const tables = await d1Helper.listTables(id);
        res.json(tables);
    } catch (error) {
        res.status(errorStatus(error)).json({ error: error.message });
    }
});

// Query Table
router.get('/:id/query', async (req, res) => {
    const { id } = req.params;
    const { table, limit = 100 } = req.query;

    if (!table) return res.status(400).json({ error: "Table name is required" });
    const dbMeta = resourceService.getD1().find(d => d.id === id);
    if (!dbMeta) return res.status(404).json({ error: "Database not found" });

    try {
        const result = await d1Helper.queryTable(id, table, parseInt(limit, 10));
        res.json(result);
    } catch (error) {
        res.status(errorStatus(error)).json({ error: error.message });
    }
});

router.get('/:id/schema/:table', async (req, res) => {
    const { id, table } = req.params;
    if (!resourceService.getD1().some(database => database.id === id)) {
        return res.status(404).json({ error: "Database not found" });
    }
    try {
        res.json(await d1Helper.getTableStructure(id, table));
    } catch (error) {
        res.status(errorStatus(error)).json({ error: error.message });
    }
});

module.exports = router;
