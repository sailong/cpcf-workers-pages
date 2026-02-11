const { createProxyMiddleware } = require('http-proxy-middleware');
const projectService = require('../services/project-service');

const MANAGER_SERVICE_PORT = process.env.MANAGER_SERVICE_PORT || 3000;
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost';

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
    const host = req.headers.host;
    if (!host) return next();

    // Remove port
    const hostname = host.split(':')[0];
    const domainSuffix = '.' + ROOT_DOMAIN;

    if (hostname.endsWith(domainSuffix)) {
        const prefix = hostname.slice(0, -domainSuffix.length);
        console.log(`[ProxyRouter] Match! Prefix: ${prefix}, Suffix: ${domainSuffix}`);

        let projectName = prefix;
        let projectType = null;

        // Try to match type suffix: name-worker or name-pages
        const match = prefix.match(/^(.*)-(worker|pages)$/);
        if (match) {
            projectName = match[1];
            projectType = match[2];
        }

        const projects = projectService.getAll();
        const project = projects.find(p => {
            const nameMatch = p.name.toLowerCase() === projectName.toLowerCase();
            const typeMatch = projectType ? (p.type && p.type.toLowerCase() === projectType.toLowerCase()) : true;
            return nameMatch && typeMatch;
        });

        if (project && project.port) {
            req.proxyTarget = `http://127.0.0.1:${project.port}`;
            req.proxyProjectName = project.name;
            req.proxyProjectPort = project.port;

            return dynamicProxy(req, res, next);
        }

        console.log(`[ProxyRouter] Lookup failed for Name: ${projectName}, Type: ${projectType}`);
        return res.status(404).send(`Project '${projectName}' ${projectType ? `(type: ${projectType})` : ''} not found.`);
    }

    next();
};
