'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const authService = require('./services/auth-service');
const cryptoHelper = require('./utils/crypto-helper');
const { assertProductionIngressConfigured, createIngressGuard } = require('./middleware/ingress');
const { configuredProjectBaseDomains } = require('./utils/project-hostname');
const { errorStatus } = require('./utils/http-error');
const {
    configureTrustedProxy,
    createHostGuard,
    sameOrigin,
    securityHeaders
} = require('./middleware/security');

const MANAGER_SERVICE_PORT = Number.parseInt(process.env.MANAGER_SERVICE_PORT || '3000', 10);

function assertProductionPasswordConfigured(service = authService, environment = process.env) {
    if (environment.NODE_ENV === 'production' && service.isDefaultPassword()) {
        throw new Error('Refusing production startup with the default administrator password; set AUTH_PASSWORD first');
    }
}

function createApp() {
    const app = express();
    configureTrustedProxy(app);

    app.disable('x-powered-by');
    app.use(createIngressGuard());
    app.use(createHostGuard());
    app.use(require('./middleware/proxy'));
    // Worker and Pages responses own their CORS and CSP behavior.
    app.use(securityHeaders);
    app.use(sameOrigin);
    app.use(express.static(path.join(__dirname, 'client/dist')));
    app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb', strict: true }));
    app.use(require('./middleware/auth'));

    app.use('/api', require('./routes/auth'));
    app.use('/api/projects', require('./routes/projects'));
    app.use('/api/build', require('./routes/build'));
    app.use('/api/upload', require('./routes/upload'));
    app.get('/api/config', (req, res) => {
        let requestPort = '';
        try { requestPort = new URL(`${req.protocol}://${req.get('host')}`).port; } catch { }
        res.json({
            managerPort: MANAGER_SERVICE_PORT,
            projectBaseDomain: configuredProjectBaseDomains()[0],
            projectProtocol: process.env.PROJECTS_PROTOCOL || req.protocol,
            projectPort: process.env.PROJECTS_PUBLIC_PORT
                || (process.env.NODE_ENV === 'production' ? '' : requestPort)
        });
    });
    app.use('/api/resources/kv', require('./routes/resources-kv'));
    app.use('/api/resources/d1', require('./routes/resources-d1'));
    app.use('/api/resources/r2', require('./routes/resources-r2'));
    app.use('/api/trash', require('./routes/trash'));
    app.use('/api/operations', require('./routes/operations'));
    app.use('/api/system', require('./routes/system'));
    app.use('/api/projects', require('./routes/files'));

    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        const isDev = process.env.NODE_ENV !== 'production';
        console.error('[Global Error]', err.message);
        const status = err.type === 'entity.too.large' ? 413 : errorStatus(err);
        res.status(status).json({
            error: err.type === 'entity.too.large'
                ? 'Request body is too large'
                : (err.publicMessage || (status < 500 || isDev ? err.message : 'Internal Server Error')),
            details: isDev ? err.message : undefined
        });
    });

    app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, 'client/dist/index.html')));
    return app;
}

async function bootstrap() {
    for (const directory of [config.DATA_DIR, config.PROJECTS_DIR, config.UPLOADS_DIR, config.TEMP_BUILD_DIR, config.D1_DIR]) {
        await fs.promises.mkdir(directory, { recursive: true });
    }
    authService.attachDatabase(require('./services/database').getDatabase());
    await Promise.all([authService.initialize(), cryptoHelper.initialize()]);
    assertProductionPasswordConfigured();
    assertProductionIngressConfigured();
    const projectService = require('./services/project-service');
    for (const project of projectService.getAll()) {
        let projectChanged = false;
        for (const varData of Object.values(project.envVars || {})) {
            if (!varData || varData.type !== 'secret' || typeof varData.value !== 'string') continue;
            const migrated = cryptoHelper.migrateStoredSecret(varData.value, project.id);
            if (migrated.migrated) {
                varData.value = migrated.ciphertext;
                projectChanged = true;
            }
        }
        if (projectChanged) projectService.update(project.id, { envVars: project.envVars });
    }
    const migration = await require('./services/release-service').migrateLegacyProjects();
    if (migration.migrated.length) console.log(`[Release] Migrated ${migration.migrated.length} legacy project(s)`);
    for (const skipped of migration.skipped) console.warn(`[Release] Skipped legacy project ${skipped.id}: ${skipped.reason}`);
    require('./services/release-service').pruneAll();
    const deploymentService = require('./services/deployment-service');
    const interruptedOperations = deploymentService.recoverInterrupted();
    deploymentService.pruneAll();
    if (interruptedOperations) console.log(`[Deploy] Recovered ${interruptedOperations} interrupted operation(s)`);
    require('./services/runtime-log-service').pruneAll();
    const buildArtifacts = require('./services/build-artifact-service');
    const expiredBuilds = buildArtifacts.cleanupExpired();
    if (expiredBuilds.length) console.log(`[Build] Removed ${expiredBuilds.length} expired artifact(s)`);
    buildArtifacts.startScheduler();
}

async function startServer() {
    await bootstrap();
    const projectService = require('./services/project-service');
    const runtimeService = require('./services/runtime-service');
    const resourceService = require('./services/resource-service');
    const { startResourceCleanupScheduler } = require('./services/resource-cleanup-scheduler');

    await runtimeService.startAll();
    const app = createApp();
    return new Promise((resolve, reject) => {
        const server = app.listen(MANAGER_SERVICE_PORT, () => {
            console.log(`CCFWP Manager Service running on port ${MANAGER_SERVICE_PORT}`);
            startResourceCleanupScheduler({ resourceService, runtimeService });
            resolve(server);
        });
        server.once('error', reject);
    });
}

async function stopServer(server) {
    if (server?.listening) {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    const runtimeService = require('./services/runtime-service');
    await runtimeService.stopAll();
    require('./services/build-artifact-service').stopScheduler();
}

if (require.main === module) {
    startServer().then(server => {
        let stopping = false;
        const shutdown = signal => {
            if (stopping) return;
            stopping = true;
            console.log(`[Shutdown] ${signal}`);
            stopServer(server).then(() => process.exit(0)).catch(error => {
                console.error('[Shutdown] Failed:', error);
                process.exit(1);
            });
        };
        process.once('SIGTERM', () => shutdown('SIGTERM'));
        process.once('SIGINT', () => shutdown('SIGINT'));
    }).catch(error => {
        console.error('[Startup] Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = { assertProductionPasswordConfigured, bootstrap, createApp, startServer, stopServer };
