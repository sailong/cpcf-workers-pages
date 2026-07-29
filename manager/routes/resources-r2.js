const express = require('express');
const router = express.Router();
const fs = require('fs');
const resourceService = require('../services/resource-service');
const runtimeService = require('../services/runtime-service');
const upload = require('../middleware/upload');
const fetch = global.fetch;

// Proxy Helper
const getR2AdminUrl = () => `http://127.0.0.1:${runtimeService.r2Admin.port}`;

// Get R2
router.get('/', (req, res) => res.json(resourceService.getR2()));

// Create R2
router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (resourceService.getR2().find(b => b.name === name)) return res.status(400).json({ error: "Duplicate name" });

    const id = `r2-${Date.now().toString(36)}`;
    const newBucket = { id, name, created: new Date().toISOString() };

    resourceService.getAll().r2.push(newBucket);
    resourceService.save();

    runtimeService.updateResources();
    runtimeService.r2Admin.restart(resourceService.getAll());

    res.json(newBucket);
});

// Delete R2
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const resources = resourceService.getAll();
    const idx = resources.r2.findIndex(b => b.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    resources.r2.splice(idx, 1);
    resourceService.save();

    runtimeService.updateResources();
    runtimeService.r2Admin.restart(resourceService.getAll());

    res.json({ success: true, id });
});

// List Files
router.get('/:id/files', async (req, res) => {
    const { id } = req.params;
    const { cursor, limit, prefix, delimiter } = req.query;
    const url = new URL(`${getR2AdminUrl()}/list`);
    url.searchParams.set('bucket', id);
    if (cursor) url.searchParams.set('cursor', cursor);
    if (limit) url.searchParams.set('limit', limit);
    if (prefix) url.searchParams.set('prefix', prefix);
    if (delimiter) url.searchParams.set('delimiter', delimiter);

    try {
        const upstream = await fetch(url);
        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: await upstream.text() });
        }
        res.json(await upstream.json());
    } catch (e) {
        res.status(500).json({ error: "Failed to connect to R2 Admin: " + e.message });
    }
});

// Upload
router.post('/:id/files', upload.single('file'), async (req, res) => {
    const { id } = req.params;
    let key = req.body.key || (req.file ? req.file.originalname : null);

    try {
        const fixed = Buffer.from(key, 'latin1').toString('utf8');
        if (fixed.length < key.length && !key.includes('?')) {
            key = fixed;
        }
    } catch (e) { }

    if (!req.file || !key) return res.status(400).json({ error: "File and Key are required" });

    try {
        const fileContent = fs.readFileSync(req.file.path);
        const url = new URL(`${getR2AdminUrl()}/put`);
        url.searchParams.set('bucket', id);
        url.searchParams.set('key', key);

        const upstream = await fetch(url, {
            method: 'PUT',
            body: fileContent,
            headers: { 'Content-Type': req.file.mimetype }
        });

        fs.unlinkSync(req.file.path);

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: await upstream.text() });
        }
        res.json({ success: true, key });
    } catch (e) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Upload failed: " + e.message });
    }
});

// Delete File
router.delete('/:id/files/:key', async (req, res) => {
    const { id, key } = req.params;

    const url = new URL(`${getR2AdminUrl()}/delete`);
    url.searchParams.set('bucket', id);
    url.searchParams.set('key', key);

    try {
        const upstream = await fetch(url, { method: 'DELETE' });
        if (!upstream.ok) return res.status(upstream.status).json({ error: await upstream.text() });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Delete failed: " + e.message });
    }
});

// Download File
router.get('/:id/files/*key', async (req, res) => {
    const { id } = req.params;
    const key = Array.isArray(req.params.key) ? req.params.key.join('/') : req.params.key;

    const url = new URL(`${getR2AdminUrl()}/get`);
    url.searchParams.set('bucket', id);
    url.searchParams.set('key', key);

    try {
        const upstream = await fetch(url);
        if (!upstream.ok) {
            if (upstream.status === 404) return res.status(404).send("File not found");
            return res.status(upstream.status).send(await upstream.text());
        }

        const headers = ['Content-Type', 'Content-Length', 'ETag', 'Last-Modified', 'Cache-Control'];
        headers.forEach(h => {
            if (upstream.headers.has(h)) res.setHeader(h, upstream.headers.get(h));
        });

        if (upstream.body && typeof upstream.body.pipe === 'function') {
            upstream.body.pipe(res);
        } else if (upstream.body) {
            const { Readable } = require('stream');
            Readable.fromWeb(upstream.body).pipe(res);
        }
    } catch (e) {
        res.status(500).send("Download failed: " + e.message);
    }
});

module.exports = router;
