const { createProxyMiddleware } = require('http-proxy-middleware');
const projectService = require('../services/project-service');

const MANAGER_SERVICE_PORT = process.env.MANAGER_SERVICE_PORT || 3000;


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
    let prefix = null;
    let autoMatched = false;

    // Universal Dynamic Match
    // Matches any host starting with "project-type." regardless of the domain suffix.
    // Supports:
    // - project-worker.example.com
    // - project-pages.127.0.0.1
    // - project-worker.localhost
    const match = hostname.match(/^(.*)-(worker|pages)\./);

    // Debug log to trace routing decisons
    console.log(`[ProxyRouter] Host=${hostname} (Origin: ${req.headers['x-forwarded-host'] ? 'X-Forwarded-Host' : 'Direct'}). Match? ${match ? 'YES' : 'NO'}`);

    if (match) {
        // match[1] is name, match[2] is type
        prefix = `${match[1]}-${match[2]}`;
    }

    if (prefix) {
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

        if (project && project.port && project.status === 'running') {
            req.proxyTarget = `http://127.0.0.1:${project.port}`;
            req.proxyProjectName = project.name;
            req.proxyProjectPort = project.port;

            return dynamicProxy(req, res, next);
        }

        console.log(`[ProxyRouter] Lookup failed or project stopped for Name: ${projectName}, Type: ${projectType}`);
        return res.status(404).send(`Running project '${projectName}' ${projectType ? `(type: ${projectType})` : ''} not found.`);
    }

    next();
};
