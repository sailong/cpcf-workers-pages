'use strict';

require('dotenv').config();
const fs = require('node:fs');
const config = require('../config');
const { createDatabase } = require('../services/database');
const { createAuthService } = require('../services/auth-service');

async function main() {
    if (process.env.NODE_ENV === 'production' && process.env.CCFWP_ALLOW_ADMIN_RESET !== '1') {
        throw new Error('Production reset requires CCFWP_ALLOW_ADMIN_RESET=1 and a stopped manager service');
    }

    const password = process.env.CCFWP_ADMIN_PASSWORD;
    if (!password) throw new Error('Set CCFWP_ADMIN_PASSWORD; do not pass the password as a command-line argument');

    const databaseDirectory = config.DATA_DIR;
    await fs.promises.mkdir(databaseDirectory, { recursive: true, mode: 0o700 });
    const auth = createAuthService({ authFile: config.AUTH_FILE, initialPassword: password });
    const validation = auth.validatePasswordStrength(password);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const db = createDatabase();
    try {
        auth.attachDatabase(db);
        await auth.initialize();
        await auth.setPassword(password);
        console.log('Administrator password updated. Restart the manager to load the new credential.');
    } finally {
        db.close();
    }
}

main().catch(error => {
    console.error(`Password reset failed: ${error.message}`);
    process.exitCode = 1;
});
