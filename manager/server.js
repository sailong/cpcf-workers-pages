'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const authService = require('./services/auth-service');
const cryptoHelper = require('./utils/crypto-helper');
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
    app.get('/api/config', (req, res) => res.json({ managerPort: MANAGER_SERVICE_PORT }));
    app.use('/api/resources/kv', require('./routes/resources-kv'));
    app.use('/api/resources/d1', require('./routes/resources-d1'));
    app.use('/api/resources/r2', require('./routes/resources-r2'));
    app.use('/api/projects', require('./routes/files'));

    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        const isDev = process.env.NODE_ENV !== 'production';
        console.error('[Global Error]', err.message);
        res.status(err.type === 'entity.too.large' ? 413 : 500).json({
            error: err.type === 'entity.too.large' ? 'Request body is too large' : 'Internal Server Error',
            details: isDev ? err.message : undefined
        });
    });

    app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, 'client/dist/index.html')));
    return app;
}

async function bootstrap() {
    for (const directory of [config.DATA_DIR, config.UPLOADS_DIR, config.TEMP_BUILD_DIR, config.D1_DIR]) {
        await fs.promises.mkdir(directory, { recursive: true });
    }
    await Promise.all([authService.initialize(), cryptoHelper.initialize()]);
    assertProductionPasswordConfigured();
    const projectService = require('./services/project-service');
    let secretsMigrated = false;
    for (const project of projectService.getAll()) {
        for (const varData of Object.values(project.envVars || {})) {
            if (!varData || varData.type !== 'secret' || typeof varData.value !== 'string') continue;
            const migrated = cryptoHelper.migrateStoredSecret(varData.value, project.id);
            if (migrated.migrated) {
                varData.value = migrated.ciphertext;
                secretsMigrated = true;
            }
        }
    }
    if (secretsMigrated) projectService.save();
}

async function startServer() {
    await bootstrap();
    const projectService = require('./services/project-service');
    const runtimeService = require('./services/runtime-service');
    const killPort = require('./utils/port-killer');

    if (await projectService.isSystemPortInUse(MANAGER_SERVICE_PORT)) {
        await killPort(MANAGER_SERVICE_PORT);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const app = createApp();
    return new Promise((resolve, reject) => {
        const server = app.listen(MANAGER_SERVICE_PORT, () => {
            console.log(`CCFWP Manager Service running on port ${MANAGER_SERVICE_PORT}`);
            runtimeService.startAll().catch(error => console.error('[Startup] Runtime restore failed:', error));
            resolve(server);
        });
        server.once('error', reject);
    });
}

if (require.main === module) {
    startServer().catch(error => {
        console.error('[Startup] Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = { assertProductionPasswordConfigured, bootstrap, createApp, startServer };
