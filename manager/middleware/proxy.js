const { createProxyMiddleware } = require('http-proxy-middleware');
const projectService = require('../services/project-service');
const runtimeService = require('../services/runtime-service');
const { projectConcurrencyGate } = require('./project-concurrency');
const { configuredProjectBaseDomains, parseProjectHostname } = require('../utils/project-hostname');

const MANAGER_SERVICE_PORT = process.env.MANAGER_SERVICE_PORT || 3000;
const concurrencyGate = projectConcurrencyGate;
const projectBaseDomains = configuredProjectBaseDomains();


// Internal proxy instance
const dynamicProxy = createProxyMiddleware({
    // default fallback, overridden by router
    target: `http://127.0.0.1:${MANAGER_SERVICE_PORT}`,
    router: (req) => {
        // Use the target we determined in the wrapper middleware
        return req.proxyTarget;
    },
    changeOrigin: true,
    ws: true,
    logLevel: 'error',
    onError: (err, req, res) => {
        const pName = req.proxyProjectName || 'Unknown';
        const pPort = req.proxyProjectPort || 'Unknown';
        if (!res.headersSent) {
            res.status(502).send(`Bad Gateway: Project '${pName}' not reachable (Port ${pPort}). Is it running?`);
        }
    }
});

module.exports = function (req, res, next) {
    // Express only honors forwarded host data when the immediate proxy is trusted.
    const hostname = req.hostname;
    if (!hostname) return next();
    const route = parseProjectHostname(hostname, projectBaseDomains);

    if (route) {
        const { projectName, projectType } = route;

        const projects = projectService.getAll();
        const project = projects.find(p => {
            const nameMatch = p.name.toLowerCase() === projectName.toLowerCase();
            const typeMatch = p.type && p.type.toLowerCase() === projectType;
            return nameMatch && typeMatch;
        });

        const runtimeTarget = project ? runtimeService.runtime.getTarget(project.id) : null;
        if (project && project.port && project.status === 'running' && runtimeTarget) {
            if (!concurrencyGate.acquire(project, req, res)) return;
            req.proxyTarget = runtimeTarget;
            req.proxyProjectName = project.name;
            req.proxyProjectPort = project.port;

            return dynamicProxy(req, res, next);
        }

        return res.status(404).send(`Running project '${projectName}' (type: ${projectType}) not found.`);
    }

    next();
};
