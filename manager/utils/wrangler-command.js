'use strict';

const path = require('node:path');

function getWranglerCommand() {
    const packagePath = require.resolve('wrangler/package.json');
    const packageJson = require(packagePath);
    const binaryPath = path.resolve(path.dirname(packagePath), packageJson.bin.wrangler);
    return { command: process.execPath, args: [binaryPath], version: packageJson.version };
}

module.exports = { getWranglerCommand };
