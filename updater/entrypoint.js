'use strict';

const fs = require('fs');
const { spawn } = require('child_process');
const config = require('../manager/config');
const { ensureInitialRelease, readCurrentVersion, resolveCurrentDirectory } = require('./release-layout');

async function main() {
    const root = config.APP_RELEASE_ROOT;
    await ensureInitialRelease(root, '/opt/ccfwp-builtin', process.env.CCFWP_BUILTIN_VERSION || 'v1.0.0');
    const current = resolveCurrentDirectory(root);
    const version = readCurrentVersion(root);
    const serverFile = `${current}/manager/server.js`;
    if (!fs.existsSync(serverFile)) throw new Error(`Current release is missing ${serverFile}`);
    process.env.CCFWP_RELEASE_VERSION = version || process.env.CCFWP_RELEASE_VERSION || 'v0.0.0';
    process.env.PLATFORM_DATA_DIR = config.DATA_DIR;
    const child = spawn(process.execPath, [serverFile], { stdio: 'inherit', env: process.env });
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.once(signal, () => {
            if (!child.killed) child.kill(signal);
        });
    }
    child.on('exit', (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
    child.on('error', error => { console.error(error); process.exit(1); });
}

main().catch(error => { console.error(`[Release entrypoint] ${error.stack || error.message}`); process.exit(1); });
