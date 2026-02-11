const express = require('express');
const router = express.Router();
const resourceService = require('../services/resource-service');
const runtimeService = require('../services/runtime-service');
const kvStorage = require('../utils/kv-storage');

// Get All KV Namespaces
router.get('/', (req, res) => {
    res.json(resourceService.getKV());
});

// Create KV Namespace
router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const kvs = resourceService.getKV();
    if (kvs.find(kv => kv.name === name)) {
        return res.status(400).json({ error: "KV Namespace already exists" });
    }

    const id = `kv-${Date.now().toString(36)}`;
    const newKV = { id, name, created: new Date().toISOString() };

    resourceService.getAll().kv.push(newKV);
    resourceService.save();

    // Init storage (create empty file)
    // Actually kvStorage lazy creates. But init ensures dir exists.
    // kvStorage.init(id); // Doesn't exist, logic was in server.js to just save resources?
    // server.js 1459: just saves resources.

    runtimeService.updateResources();
    res.json(newKV);
});

// Delete KV Namespace
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const resources = resourceService.getAll();
    const idx = resources.kv.findIndex(k => k.id === id);

    if (idx === -1) return res.status(404).json({ error: "KV Namespace not found" });

    // Delete data file
    try {
        kvStorage.deleteNamespace(id);
    } catch (e) { console.error("Failed to delete KV data", e); }

    resources.kv.splice(idx, 1);
    resourceService.save();

    runtimeService.updateResources();
    res.json({ success: true, id });
});

// List Keys
router.get('/:id/keys', (req, res) => {
    const { id } = req.params;
    const { prefix, limit } = req.query;

    if (!resourceService.getKV().find(k => k.id === id)) {
        return res.status(404).json({ error: "KV Namespace not found" });
    }

    try {
        const keys = kvStorage.listKeys(id, prefix, parseInt(limit));
        res.json({ keys, list_complete: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Value
router.get('/:id/values/:key', (req, res) => {
    const { id, key } = req.params;
    if (!resourceService.getKV().find(k => k.id === id)) {
        return res.status(404).json({ error: "KV Namespace not found" });
    }
    try {
        const value = kvStorage.getValue(id, key);
        if (value === undefined || value === null) return res.status(404).json({ error: "Key not found" });
        res.json(value);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Put Value
router.put('/:id/values/:key', (req, res) => {
    const { id, key } = req.params;
    const { value } = req.body;

    if (!resourceService.getKV().find(k => k.id === id)) {
        return res.status(404).json({ error: "KV Namespace not found" });
    }
    try {
        kvStorage.setValue(id, key, value);
        res.json({ success: true, key, value });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete Key
router.delete('/:id/values/:key', (req, res) => {
    const { id, key } = req.params;
    if (!resourceService.getKV().find(k => k.id === id)) {
        return res.status(404).json({ error: "KV Namespace not found" });
    }
    try {
        kvStorage.deleteKey(id, key);
        res.json({ success: true, key });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
