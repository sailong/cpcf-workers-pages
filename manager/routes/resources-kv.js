const express = require('express');
const router = express.Router();
const resourceService = require('../services/resource-service');
const runtimeService = require('../services/runtime-service');
const auditService = require('../services/audit-service');
const { errorStatus } = require('../utils/http-error');

function hasNamespace(id) {
    return resourceService.getKV().some(namespace => namespace.id === id);
}

// Get All KV Namespaces
router.get('/', (req, res) => {
    res.json(resourceService.getKV());
});

// Create KV Namespace
router.post('/', async (req, res, next) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    let newKV;
    try {
        newKV = resourceService.create('kv', name);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.publicMessage || error.message });
    }

    try {
        await runtimeService.updateResources();
        auditService.record('resource.create', 'resource', newKV.id, { kind: 'kv', name: newKV.name });
        res.json(newKV);
    } catch (error) {
        resourceService.rollbackCreate('kv', newKV.id);
        await runtimeService.updateResources().catch(() => {});
        next(error);
    }
});

// Delete KV Namespace
router.delete('/:id', async (req, res, next) => {
    const { id } = req.params;
    const deleted = resourceService.softDelete('kv', id);
    if (!deleted) return res.status(404).json({ error: "KV Namespace not found" });

    try {
        const runtime = await runtimeService.reconcileResourceDeletion(deleted);
        res.json({ success: true, id, purgeAfter: deleted.purgeAfter, runtime });
    } catch (error) {
        next(error);
    }
});

// List Keys
router.get('/:id/keys', async (req, res) => {
    const { id } = req.params;
    const { prefix, limit, cursor } = req.query;

    if (!hasNamespace(id)) {
        return res.status(404).json({ error: "KV Namespace not found" });
    }

    try {
        const parsedLimit = Math.max(1, Math.min(1000, Number.parseInt(limit, 10) || 1000));
        const options = { prefix: typeof prefix === 'string' ? prefix : '', limit: parsedLimit };
        if (typeof cursor === 'string' && cursor) options.cursor = cursor;
        const result = await runtimeService.resourceRuntime.withResource('kv', id,
            namespace => namespace.list(options));
        res.json(result);
    } catch (error) {
        res.status(errorStatus(error)).json({ error: error.message });
    }
});

// Get Value
router.get('/:id/values/:key', async (req, res) => {
    const { id, key } = req.params;
    if (!hasNamespace(id)) {
        return res.status(404).json({ error: "KV Namespace not found" });
    }
    try {
        const result = await runtimeService.resourceRuntime.withResource('kv', id,
            namespace => namespace.getWithMetadata(key, 'text'));
        if (!result || result.value === null) return res.status(404).json({ error: "Key not found" });
        const value = result.metadata?.ccfwpEncoding === 'json' ? JSON.parse(result.value) : result.value;
        res.json({ value, metadata: result.metadata || null });
    } catch (e) {
        res.status(errorStatus(e)).json({ error: e.message });
    }
});

// Put Value
router.put('/:id/values/:key', async (req, res) => {
    const { id, key } = req.params;
    const { value, metadata, expiration, expirationTtl } = req.body;

    if (!hasNamespace(id)) {
        return res.status(404).json({ error: "KV Namespace not found" });
    }
    try {
        const encoded = typeof value === 'string' ? value : JSON.stringify(value);
        const options = {};
        if (metadata !== undefined) options.metadata = metadata;
        if (typeof value !== 'string') options.metadata = { ...(metadata || {}), ccfwpEncoding: 'json' };
        if (expiration !== undefined && expiration !== null) options.expiration = expiration;
        if (expirationTtl !== undefined && expirationTtl !== null) options.expirationTtl = expirationTtl;
        await runtimeService.resourceRuntime.withResource('kv', id,
            namespace => namespace.put(key, encoded, options));
        res.json({ success: true, key, value });
    } catch (e) {
        res.status(errorStatus(e)).json({ error: e.message });
    }
});

// Delete Key
router.delete('/:id/values/:key', async (req, res) => {
    const { id, key } = req.params;
    if (!hasNamespace(id)) {
        return res.status(404).json({ error: "KV Namespace not found" });
    }
    try {
        await runtimeService.resourceRuntime.withResource('kv', id, namespace => namespace.delete(key));
        res.json({ success: true, key });
    } catch (e) {
        res.status(errorStatus(e)).json({ error: e.message });
    }
});

module.exports = router;
