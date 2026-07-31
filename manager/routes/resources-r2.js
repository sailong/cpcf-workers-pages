'use strict';

const express = require('express');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const resourceService = require('../services/resource-service');
const runtimeService = require('../services/runtime-service');
const upload = require('../middleware/upload');
const auditService = require('../services/audit-service');

const router = express.Router();

function hasBucket(id) {
    return resourceService.getR2().some(bucket => bucket.id === id);
}

router.get('/', (req, res) => res.json(resourceService.getR2()));

router.post('/', async (req, res, next) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    let bucket;
    try {
        bucket = resourceService.create('r2', name);
        await runtimeService.updateResources();
        auditService.record('resource.create', 'resource', bucket.id, { kind: 'r2', name: bucket.name });
        res.json(bucket);
    } catch (error) {
        if (bucket) {
            resourceService.rollbackCreate('r2', bucket.id);
            await runtimeService.updateResources().catch(() => {});
            return next(error);
        }
        res.status(error.statusCode || 500).json({ error: error.publicMessage || error.message });
    }
});

router.delete('/:id', async (req, res, next) => {
    const deleted = resourceService.softDelete('r2', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    try {
        const runtime = await runtimeService.reconcileResourceDeletion(deleted);
        res.json({ success: true, id: req.params.id, purgeAfter: deleted.purgeAfter, runtime });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/files', async (req, res) => {
    const { id } = req.params;
    if (!hasBucket(id)) return res.status(404).json({ error: 'Bucket not found' });
    const options = {};
    if (typeof req.query.cursor === 'string' && req.query.cursor) options.cursor = req.query.cursor;
    if (typeof req.query.prefix === 'string' && req.query.prefix) options.prefix = req.query.prefix;
    if (typeof req.query.delimiter === 'string' && req.query.delimiter) options.delimiter = req.query.delimiter;
    options.limit = Math.max(1, Math.min(1000, Number.parseInt(req.query.limit, 10) || 100));
    try {
        const listing = await runtimeService.resourceRuntime.withResource('r2', id, bucket => bucket.list(options));
        res.json(listing);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

router.post('/:id/files', upload.singleSafe('file'), async (req, res) => {
    const { id } = req.params;
    let key = req.body.key || req.file?.originalname;
    try {
        if (key) {
            const decoded = Buffer.from(key, 'latin1').toString('utf8');
            if (decoded.length < key.length && !key.includes('?')) key = decoded;
        }
    } catch { }
    if (!hasBucket(id)) {
        if (req.file) fs.rmSync(req.file.path, { force: true });
        return res.status(404).json({ error: 'Bucket not found' });
    }
    if (!req.file || !key) return res.status(400).json({ error: 'File and Key are required' });
    try {
        const body = await fs.promises.readFile(req.file.path);
        await runtimeService.resourceRuntime.withResource('r2', id, bucket => bucket.put(key, body, {
            httpMetadata: { contentType: req.file.mimetype }
        }));
        res.json({ success: true, key });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: `Upload failed: ${error.message}` });
    } finally {
        await fs.promises.rm(req.file.path, { force: true });
    }
});

router.delete('/:id/files/*key', async (req, res) => {
    const { id } = req.params;
    const key = Array.isArray(req.params.key) ? req.params.key.join('/') : req.params.key;
    if (!hasBucket(id)) return res.status(404).json({ error: 'Bucket not found' });
    try {
        await runtimeService.resourceRuntime.withResource('r2', id, bucket => bucket.delete(key));
        res.json({ success: true });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: `Delete failed: ${error.message}` });
    }
});

router.get('/:id/files/*key', async (req, res) => {
    const { id } = req.params;
    const key = Array.isArray(req.params.key) ? req.params.key.join('/') : req.params.key;
    if (!hasBucket(id)) return res.status(404).send('Bucket not found');
    try {
        const object = await runtimeService.resourceRuntime.withResource('r2', id, bucket => bucket.get(key));
        if (!object) return res.status(404).send('File not found');
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        for (const [name, value] of headers) res.setHeader(name, value);
        res.setHeader('ETag', object.httpEtag);
        res.setHeader('Content-Length', String(object.size));
        if (object.uploaded) res.setHeader('Last-Modified', object.uploaded.toUTCString());
        Readable.fromWeb(object.body).pipe(res);
    } catch (error) {
        res.status(error.statusCode || 500).send(`Download failed: ${error.message}`);
    }
});

module.exports = router;
