'use strict';

const config = require('../config');
const { dryRunMigrations, SCHEMA_VERSION } = require('../services/database');

dryRunMigrations({ databaseFile: process.env.CCFWP_MIGRATION_DATABASE_FILE || config.DATABASE_FILE })
    .then(result => {
        process.stdout.write(JSON.stringify({ ...result, schemaVersion: SCHEMA_VERSION }) + '\n');
    })
    .catch(error => {
        process.stderr.write(`${error.stack || error.message}\n`);
        process.exitCode = 1;
    });
