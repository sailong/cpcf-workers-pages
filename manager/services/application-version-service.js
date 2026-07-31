'use strict';

const fs = require('fs');
const path = require('path');

const SEMVER = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function normalizeVersion(value) {
    const version = String(value || '').trim();
    if (!SEMVER.test(version)) throw new Error(`Invalid application version: ${version || '(empty)'}`);
    return version;
}

function getApplicationVersion() {
    if (process.env.CCFWP_RELEASE_VERSION) {
        try { return normalizeVersion(process.env.CCFWP_RELEASE_VERSION); } catch { /* fall through to package metadata */ }
    }
    try {
        const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app-version.json'), 'utf8'));
        return normalizeVersion(metadata.version);
    } catch { /* fall through to package metadata */ }
    const packageFile = path.join(__dirname, '..', 'package.json');
    try {
        const packageData = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
        return normalizeVersion(`v${packageData.version}`);
    } catch {
        return 'v0.0.0';
    }
}

module.exports = { SEMVER, getApplicationVersion, normalizeVersion };
