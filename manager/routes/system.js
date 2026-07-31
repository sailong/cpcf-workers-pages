'use strict';

const express = require('express');
const diagnostics = require('../services/system-diagnostics-service');
const upgrades = require('../services/application-upgrade-service');
const audit = require('../services/audit-service');
const { SEMVER } = require('../services/application-version-service');

const router = express.Router();

router.get('/status', async (req, res, next) => {
    try {
        const [status, application] = await Promise.all([
            diagnostics.getStatus(req.hostname),
            upgrades.getStatus()
        ]);
        res.json({ ...status, application });
    } catch (error) {
        next(error);
    }
});

router.get('/upgrade', async (req, res, next) => {
    try { res.json(await upgrades.getStatus()); } catch (error) { next(error); }
});

router.post('/upgrade/check', async (req, res, next) => {
    try { res.json(await upgrades.check(req.body?.version)); } catch (error) { next(error); }
});

router.post('/upgrade', async (req, res, next) => {
    try {
        if (!SEMVER.test(String(req.body?.version || ''))) {
            return res.status(400).json({ error: 'A strict vX.Y.Z SemVer release tag is required' });
        }
        audit.record('system.upgrade_requested', 'system', null, { version: req.body.version });
        const result = await upgrades.startUpgrade(req.body.version);
        res.status(202).json(result);
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
        next(error);
    }
});

router.post('/upgrade/rollback', async (req, res, next) => {
    try {
        audit.record('system.rollback_requested', 'system');
        const result = await upgrades.rollback();
        res.status(202).json(result);
    } catch (error) { next(error); }
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
