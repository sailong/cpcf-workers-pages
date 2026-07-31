'use strict';

const express = require('express');
const diagnostics = require('../services/system-diagnostics-service');

const router = express.Router();

router.get('/status', async (req, res, next) => {
    try {
        res.json(await diagnostics.getStatus(req.hostname));
    } catch (error) {
        next(error);
    }
});

router.post('/domains/confirm', (req, res, next) => {
    try {
        res.json(diagnostics.confirm(req.body || {}, req.hostname));
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
        next(error);
    }
});

module.exports = router;
