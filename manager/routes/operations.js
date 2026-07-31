'use strict';

const express = require('express');
const deploymentService = require('../services/deployment-service');
const auditService = require('../services/audit-service');

const router = express.Router();

router.get('/deployments', (req, res) => {
    res.json(deploymentService.listAll(req.query.limit));
});

router.get('/audit-events', (req, res) => {
    res.json(auditService.list(req.query.limit));
});

module.exports = router;
