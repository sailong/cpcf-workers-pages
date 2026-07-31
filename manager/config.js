const path = require('path');
const DATA_DIR = path.resolve(process.env.PLATFORM_DATA_DIR || path.join(__dirname, '../.platform-data'));
const HOST_DATA_DIR = path.resolve(process.env.PLATFORM_DATA_HOST_DIR || DATA_DIR);

module.exports = {
    DATA_DIR,
    HOST_DATA_DIR,
    PROJECTS_DIR: path.join(DATA_DIR, 'projects'),
    UPLOADS_DIR: path.join(DATA_DIR, 'uploads'),
    TEMP_BUILD_DIR: path.join(DATA_DIR, 'temp_builds'),
    BUILD_ARTIFACT_TTL_MS: Number.parseInt(process.env.BUILD_ARTIFACT_TTL_MS || String(24 * 60 * 60 * 1000), 10),
    MAX_RELEASES_PER_PROJECT: Number.parseInt(process.env.MAX_RELEASES_PER_PROJECT || '20', 10),
    MAX_ACTIVATIONS_PER_PROJECT: Number.parseInt(process.env.MAX_ACTIVATIONS_PER_PROJECT || '100', 10),
    MAX_OPERATIONS_PER_PROJECT: Number.parseInt(process.env.MAX_OPERATIONS_PER_PROJECT || '100', 10),
    OPERATION_RETENTION_MS: Number.parseInt(process.env.OPERATION_RETENTION_MS || String(30 * 24 * 60 * 60 * 1000), 10),
    MAX_RUNTIME_LOGS_PER_PROJECT: Number.parseInt(process.env.MAX_RUNTIME_LOGS_PER_PROJECT || '2000', 10),
    RUNTIME_LOG_RETENTION_MS: Number.parseInt(process.env.RUNTIME_LOG_RETENTION_MS || String(7 * 24 * 60 * 60 * 1000), 10),
    D1_DIR: path.join(DATA_DIR, 'd1-databases'),
    KV_DATA_DIR: path.join(DATA_DIR, 'kv-data'),
    WRANGLER_STATE_DIR: path.join(DATA_DIR, 'wrangler-shared-state'),
    R2_STATE_DIR: path.join(DATA_DIR, 'r2-data'),
    PROJECT_RUNTIME_STATE_DIR: path.join(DATA_DIR, 'project-runtime-state'),
    RUNTIME_CONTROL_DIR: path.join(DATA_DIR, 'runtime-control'),
    APP_RELEASE_ROOT: path.resolve(process.env.CCFWP_APP_RELEASE_ROOT || path.join(DATA_DIR, 'app-releases')),
    UPDATER_URL: process.env.CCFWP_UPDATER_URL || 'http://ccfwp-updater:8002',
    UPDATER_TOKEN: process.env.CCFWP_UPDATER_TOKEN || '',
    RELEASE_RETENTION: Number.parseInt(process.env.CCFWP_RELEASE_RETENTION || '3', 10),
    RESOURCE_GATEWAY_SECRET_FILE: path.join(DATA_DIR, 'resource-gateway.key'),
    RESOURCE_GATEWAY_PORT: Number.parseInt(process.env.RESOURCE_GATEWAY_PORT || '9200', 10),
    DATABASE_FILE: path.join(DATA_DIR, 'control-plane.sqlite3'),
    PROJECTS_FILE: path.join(DATA_DIR, 'projects.json'),
    RESOURCES_FILE: path.join(DATA_DIR, 'resources.json'),
    AUTH_FILE: path.join(DATA_DIR, 'auth.json'),
    // Build dependency trust controls. Uploaded package graphs are untrusted:
    // only allowlisted registries and optional offline/prefer-offline modes.
    BUILD_NETWORK_MODE: String(process.env.BUILD_NETWORK_MODE || 'prefer-offline').toLowerCase(),
    BUILD_DEFAULT_REGISTRY: process.env.BUILD_DEFAULT_REGISTRY || process.env.NPM_CONFIG_REGISTRY || 'https://registry.npmmirror.com/',
    BUILD_REGISTRY_ALLOWLIST: String(
        process.env.BUILD_REGISTRY_ALLOWLIST
        || process.env.BUILD_DEFAULT_REGISTRY
        || process.env.NPM_CONFIG_REGISTRY
        || 'https://registry.npmmirror.com/,https://registry.npmjs.org/'
    ).split(',').map(item => item.trim()).filter(Boolean),
};
