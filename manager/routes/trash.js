'use strict';

const express = require('express');
const resourceService = require('../services/resource-service');
const runtimeService = require('../services/runtime-service');
const { restoreResource } = require('../services/resource-restore-service');

const router = express.Router();

router.get('/', (req, res) => res.json(resourceService.listTrash()));

router.post('/:id/restore', async (req, res, next) => {
    try {
        const resource = await restoreResource(req.params.id);
        if (!resource) return res.status(404).json({ error: 'Resource not found in trash' });
        res.json(resource);
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const resource = await resourceService.purge(req.params.id, 'admin', true);
        if (!resource) return res.status(404).json({ error: 'Resource not found in trash' });
        await runtimeService.updateResources();
        res.json({ success: true, id: resource.id });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
