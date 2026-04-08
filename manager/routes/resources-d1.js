const express = require('express');
const router = express.Router();
const resourceService = require('../services/resource-service');
const runtimeService = require('../services/runtime-service');
const d1Helper = require('../utils/d1-helper');

// Get D1
router.get('/', (req, res) => res.json(resourceService.getD1()));

// Create D1
router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (resourceService.getD1().find(d => d.name === name)) return res.status(400).json({ error: "Duplicate name" });

    const id = `d1-${Date.now().toString(36)}`;
    const newDB = { id, name, created: new Date().toISOString() };

    resourceService.getAll().d1.push(newDB);
    resourceService.save();

    // Config will be lazily created on first access via d1Helper

    runtimeService.updateResources();
    res.json(newDB);
});

// Delete D1
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const resources = resourceService.getAll();
    const idx = resources.d1.findIndex(d => d.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    // No explicit delete logic for D1 files in helper/server.js?
    // D1 local data is stored in .wrangler/state/v3/d1/... 
    // Wrangler manages it. We just remove reference.

    resources.d1.splice(idx, 1);
    resourceService.save();
    runtimeService.updateResources();

    res.json({ success: true, id });
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
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
    }
});

// Query Table
router.get('/:id/query', (req, res) => {
    const { id } = req.params;
    const { table, limit = 100 } = req.query;

    if (!table) return res.status(400).json({ error: "Table name is required" });
    const dbMeta = resourceService.getD1().find(d => d.id === id);
    if (!dbMeta) return res.status(404).json({ error: "Database not found" });

    try {
        const result = d1Helper.queryTable(id, table, parseInt(limit));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
