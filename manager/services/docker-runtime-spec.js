'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const cryptoHelper = require('../utils/crypto-helper');
const { generateConfig } = require('../utils/generator');
const { createResourceBindingShim } = require('../utils/resource-binding-shim');
const { tokenForProject } = require('./resource-gateway-auth');
const { normalizeProjectCompatibility } = require('./project-compatibility');
const { resolveWithin } = require('../utils/path-helper');
const { getReleaseRoot, isReleasePath, resolveProjectPath } = require('../utils/project-paths');
const { planBuildCommand } = require('../utils/build-command-policy');

const RUNTIME_UID = Number(process.env.PROJECT_RUNTIME_UID || 10001);
const RUNTIME_GID = Number(process.env.PROJECT_RUNTIME_GID || 10001);
const RUNTIME_PORT = 8787;
const INSPECTOR_PORT = 9229;
const OWNER_LABEL = 'io.ccfwp.runtime';

function safeRuntimeSuffix(runtimeKey) {
    return crypto.createHash('sha256').update(runtimeKey).digest('hex').slice(0, 20);
}

function hostPath(absolutePath) {
    const relative = path.relative(config.DATA_DIR, absolutePath);
    if (!relative || relative === '.') return config.HOST_DATA_DIR;
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Runtime mount escapes platform data directory');
    return resolveWithin(config.HOST_DATA_DIR, relative);
}

function ensureOwnedDirectory(directory) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o750 });
    try { fs.chownSync(directory, RUNTIME_UID, RUNTIME_GID); } catch (error) {
        if (process.platform !== 'win32' && error.code !== 'EPERM') throw error;
    }
    fs.chmodSync(directory, 0o750);
}

function writeOwnedFile(file, content) {
    fs.writeFileSync(file, content, { mode: 0o440 });
    try { fs.chownSync(file, RUNTIME_UID, RUNTIME_GID); } catch (error) {
        if (process.platform !== 'win32' && error.code !== 'EPERM') throw error;
    }
    fs.chmodSync(file, 0o440);
}

function makeWritableTree(root) {
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink()) throw new Error('Build workspaces must not contain symbolic links');
        try { fs.chownSync(current, RUNTIME_UID, RUNTIME_GID); } catch (error) {
            if (process.platform !== 'win32' && error.code !== 'EPERM') throw error;
        }
        if (stat.isDirectory()) {
            fs.chmodSync(current, 0o750);
            for (const name of fs.readdirSync(current)) pending.push(path.join(current, name));
        } else if (stat.isFile()) {
            fs.chmodSync(current, (stat.mode & 0o111) ? 0o750 : 0o640);
        } else {
            throw new Error('Build workspace contains an unsupported file type');
        }
    }
}

function normalizeRegistryUrl(value) {
    if (!value) return null;
    try {
        const url = new URL(value);
        if (url.username || url.password) return null;
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        // Canonicalize trailing slash for stable allowlist comparisons.
        url.hash = '';
        url.search = '';
        const normalized = url.toString();
        return normalized.endsWith('/') ? normalized : `${normalized}/`;
    } catch {
        return null;
    }
}

function resolveBuildRegistry() {
    const rawAllowlist = process.env.BUILD_REGISTRY_ALLOWLIST
        || (config.BUILD_REGISTRY_ALLOWLIST || []).join(',')
        || process.env.BUILD_DEFAULT_REGISTRY
        || process.env.NPM_CONFIG_REGISTRY
        || 'https://registry.npmjs.org/,https://registry.npmmirror.com/';
    const allowlist = String(rawAllowlist)
        .split(',')
        .map(item => normalizeRegistryUrl(item.trim()))
        .filter(Boolean);
    const requested = normalizeRegistryUrl(process.env.NPM_CONFIG_REGISTRY || process.env.BUILD_DEFAULT_REGISTRY || config.BUILD_DEFAULT_REGISTRY);
    const fallback = normalizeRegistryUrl(process.env.BUILD_DEFAULT_REGISTRY || config.BUILD_DEFAULT_REGISTRY) || 'https://registry.npmjs.org/';
    if (requested && (allowlist.length === 0 || allowlist.includes(requested))) return requested;
    if (allowlist.includes(fallback)) return fallback;
    if (allowlist.length) return allowlist[0];
    return fallback;
}

function minimalBuildEnvironment() {
    const registry = resolveBuildRegistry();
    const environment = [
        'HOME=/tmp',
        'XDG_CONFIG_HOME=/tmp/.config',
        'CI=true',
        'FORCE_COLOR=0',
        'WRANGLER_SEND_METRICS=false',
        `NPM_CONFIG_REGISTRY=${registry}`,
        `npm_config_registry=${registry}`,
        `YARN_NPM_REGISTRY_SERVER=${registry}`
    ];
    if (process.env.NO_PROXY !== undefined) environment.push(`NO_PROXY=${process.env.NO_PROXY}`);
    return environment;
}

function resolveBuildNetworkMode() {
    const mode = String(process.env.BUILD_NETWORK_MODE || config.BUILD_NETWORK_MODE || 'prefer-offline').toLowerCase();
    if (mode === 'offline' || mode === 'prefer-offline' || mode === 'online') return mode;
    return 'prefer-offline';
}

function bindingArguments(project, resources) {
    const args = [];
    for (const binding of project.bindings?.kv || []) {
        const resource = resources.kv?.find(item => item.id === binding.resourceId);
        if (resource) args.push('--kv', `${binding.varName}=${resource.id}`);
    }
    for (const binding of project.bindings?.d1 || []) {
        const resource = resources.d1?.find(item => item.id === binding.resourceId);
        if (resource) args.push('--d1', `${binding.varName}=${resource.id}`);
    }
    for (const binding of project.bindings?.r2 || []) {
        const resource = resources.r2?.find(item => item.id === binding.resourceId);
        if (resource) args.push('--r2', `${binding.varName}=${resource.name}`);
    }
    for (const [key, variable] of Object.entries(project.envVars || {})) {
        const value = variable.type === 'secret'
            ? cryptoHelper.decryptSecret(variable.value, project.id)
            : variable.type === 'json' && typeof variable.value !== 'string'
                ? JSON.stringify(variable.value)
                : String(variable.value);
        args.push('--binding', `${key}=${value}`);
    }
    return args;
}

function createDockerRuntimeSpec(project, resources, options = {}) {
    if (!project || !project.id || !project.limits) throw new Error('A persisted project with limits is required');
    if (!isReleasePath(project.mainFile)) throw new Error('Docker runtimes accept immutable releases only');
    const { compatibilityDate, compatibilityFlags } = normalizeProjectCompatibility(project);

    const runtimeKey = options.runtimeKey || project.id;
    const suffix = safeRuntimeSuffix(runtimeKey);
    const containerName = `ccfwp-runtime-${suffix}`;
    const networkName = `ccfwp-network-${suffix}`;
    const releaseRoot = getReleaseRoot(project.mainFile);
    const artifactRoot = resolveWithin(releaseRoot, 'artifact');
    const entryAbsolute = resolveProjectPath(project.mainFile);
    const entryRelative = path.relative(artifactRoot, entryAbsolute).split(path.sep).join('/');
    if (entryRelative.startsWith('..')) throw new Error('Release entry escapes its artifact directory');

    const controlDirectory = resolveWithin(config.RUNTIME_CONTROL_DIR, suffix);
    fs.rmSync(controlDirectory, { recursive: true, force: true });
    ensureOwnedDirectory(controlDirectory);

    const wranglerScript = process.env.PROJECT_RUNTIME_WRANGLER_PATH || '/app/manager/node_modules/wrangler/bin/wrangler.js';
    const args = [wranglerScript];
    let configPath = null;
    let command = null;

    if (project.type === 'pages') {
        const target = entryRelative ? `/workspace/${entryRelative}` : '/workspace';
        const functionsDirectory = fs.existsSync(path.join(entryAbsolute, 'functions'))
            ? path.posix.join(target, 'functions') : null;
        const customWorker = fs.existsSync(path.join(entryAbsolute, '_worker.js'))
            ? path.posix.join(target, '_worker.js') : null;
        if (functionsDirectory || customWorker) {
            configPath = resolveWithin(controlDirectory, 'wrangler.toml');
            const wrapperPath = resolveWithin(controlDirectory, 'entry.mjs');
            const wrappedEntry = functionsDirectory ? '/tmp/pages-worker/index.js' : customWorker;
            const managerAlias = `ccfwp-manager-${suffix}`;
            writeOwnedFile(wrapperPath, createResourceBindingShim(project, {
                entry: wrappedEntry,
                gatewayUrl: `http://${managerAlias}:${config.RESOURCE_GATEWAY_PORT}`,
                token: tokenForProject(project.id)
            }));
            writeOwnedFile(configPath, generateConfig({
                ...project, type: 'worker', mainFile: '/runtime/entry.mjs', port: RUNTIME_PORT
            }, resources, {
                includeResourceBindings: false,
                assetsDirectory: '/tmp/pages-assets',
                assetsBinding: 'ASSETS',
                runWorkerFirst: true
            }));
            const buildTimeout = String(project.limits.buildTimeoutSeconds);
            const buildCommand = functionsDirectory
                ? 'timeout --signal=TERM --kill-after=2s "$8" node "$1" pages functions build "$3" --outdir /tmp/pages-worker && '
                : '';
            command = [
                '/bin/sh', '-c',
                'mkdir -p /tmp/pages-assets && cp -a "$2"/. /tmp/pages-assets/ && rm -rf /tmp/pages-assets/functions /tmp/pages-assets/_worker.js && '
                    + buildCommand
                    + 'exec node "$1" dev "$4" --config "$5" --port "$6" --ip 0.0.0.0 --inspector-port "$7" --persist-to /tmp/state',
                'ccfwp-pages', wranglerScript, target, functionsDirectory || '',
                '/runtime/entry.mjs', '/runtime/wrangler.toml', String(RUNTIME_PORT), String(INSPECTOR_PORT), `${buildTimeout}s`
            ];
        } else {
            args.push('pages', 'dev', target);
            args.push(...bindingArguments(project, resources));
            args.push('--compatibility-date', compatibilityDate);
            for (const flag of compatibilityFlags) args.push('--compatibility-flag', flag);
        }
    } else if (project.type === 'worker') {
        configPath = resolveWithin(controlDirectory, 'wrangler.toml');
        const wrapperPath = resolveWithin(controlDirectory, 'entry.mjs');
        const managerAlias = `ccfwp-manager-${suffix}`;
        writeOwnedFile(wrapperPath, createResourceBindingShim(project, {
            entry: entryRelative ? `/workspace/${entryRelative}` : '/workspace',
            gatewayUrl: `http://${managerAlias}:${config.RESOURCE_GATEWAY_PORT}`,
            token: tokenForProject(project.id)
        }));
        const runtimeProject = {
            ...project,
            mainFile: '/runtime/entry.mjs',
            port: RUNTIME_PORT
        };
        writeOwnedFile(configPath, generateConfig(runtimeProject, resources, { includeResourceBindings: false }));
        args.push('dev', runtimeProject.mainFile, '--config', '/runtime/wrangler.toml');
    } else {
        throw new Error(`Unsupported project type: ${project.type}`);
    }

    if (!command) {
        args.push('--port', String(RUNTIME_PORT), '--ip', '0.0.0.0');
        args.push('--inspector-port', String(INSPECTOR_PORT), '--persist-to', '/tmp/state');
        command = ['/usr/local/bin/node', ...args];
    }

    const labels = {
        [OWNER_LABEL]: 'true',
        'io.ccfwp.project-id': project.id,
        'io.ccfwp.runtime-key': runtimeKey
    };
    const mounts = [
        { Type: 'bind', Source: hostPath(artifactRoot), Target: '/workspace', ReadOnly: true }
    ];
    if (configPath) mounts.push({ Type: 'bind', Source: hostPath(controlDirectory), Target: '/runtime', ReadOnly: true });

    return {
        runtimeKey,
        containerName,
        networkName,
        endpoint: `http://${containerName}:${RUNTIME_PORT}`,
        controlDirectory,
        startupTimeoutMs: project.type === 'pages'
            ? project.limits.buildTimeoutSeconds * 1000 + 30_000
            : 30_000,
        labels,
        networkConfiguration: {
            Name: networkName,
            Driver: 'bridge',
            CheckDuplicate: true,
            Internal: false,
            Attachable: false,
            Labels: labels,
            Options: { 'com.docker.network.bridge.enable_icc': 'false' }
        },
        containerConfiguration: {
            Image: process.env.PROJECT_RUNTIME_IMAGE || 'ccfwp-platform:dev',
            Cmd: command,
            WorkingDir: '/tmp',
            User: `${RUNTIME_UID}:${RUNTIME_GID}`,
            Env: [
                'HOME=/tmp',
                'XDG_CONFIG_HOME=/tmp/.config',
                'WRANGLER_HOME=/tmp/.wrangler',
                'WRANGLER_SEND_METRICS=false',
                'NO_COLOR=1'
            ],
            Labels: labels,
            ExposedPorts: { [`${RUNTIME_PORT}/tcp`]: {} },
            HostConfig: {
                NetworkMode: networkName,
                ReadonlyRootfs: true,
                Privileged: false,
                CapDrop: ['ALL'],
                SecurityOpt: ['no-new-privileges:true'],
                PidsLimit: project.limits.pids,
                Memory: project.limits.memoryMb * 1024 * 1024,
                MemorySwap: project.limits.memoryMb * 1024 * 1024,
                NanoCpus: Math.round(project.limits.cpu * 1_000_000_000),
                OomKillDisable: false,
                Init: true,
                AutoRemove: false,
                Mounts: mounts,
                Tmpfs: {
                    '/tmp': `rw,noexec,nosuid,nodev,size=${project.limits.diskMb}m,uid=${RUNTIME_UID},gid=${RUNTIME_GID},mode=0700`
                },
                LogConfig: { Type: 'json-file', Config: { 'max-size': '10m', 'max-file': '3' } }
            },
            NetworkingConfig: {
                EndpointsConfig: { [networkName]: { Aliases: [containerName] } }
            }
        }
    };
}

function shellQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function buildValidatedShellCommand(command, workDirectory = process.cwd()) {
    return planBuildCommand(command, workDirectory, { networkMode: resolveBuildNetworkMode() }).sanitized;
}

function createDockerBuildSpec(project, command, workDirectory, options = {}) {
    if (!project?.id || !project.limits) throw new Error('A project with limits is required for builds');
    const plan = planBuildCommand(command, workDirectory, { networkMode: resolveBuildNetworkMode() });
    const absoluteWorkDirectory = path.resolve(workDirectory);
    hostPath(absoluteWorkDirectory);
    if (!fs.existsSync(absoluteWorkDirectory) || !fs.statSync(absoluteWorkDirectory).isDirectory()) {
        throw new Error('Build workspace does not exist');
    }
    makeWritableTree(absoluteWorkDirectory);

    const runtimeKey = options.runtimeKey || `build-${project.id}-${crypto.randomUUID()}`;
    const suffix = safeRuntimeSuffix(runtimeKey);
    const containerName = `ccfwp-build-${suffix}`;
    const labels = {
        [OWNER_LABEL]: 'true',
        'io.ccfwp.project-id': project.id,
        'io.ccfwp.runtime-key': runtimeKey,
        'io.ccfwp.operation': 'build'
    };

    const networkMode = resolveBuildNetworkMode();
    if (networkMode === 'offline' && plan.needsNetwork) {
        // Offline mode still accepts install commands, but the container has no egress.
        // Prefer lockfile installs with a pre-populated node_modules/cache.
    }
    const stages = plan.stages.map((stage, index) => {
        const stageSuffix = `${suffix}-${index + 1}`;
        const stageContainerName = `${containerName}-${index + 1}`;
        const stageNetworkName = `ccfwp-build-network-${stageSuffix}`;
        const stageNeedsNetwork = networkMode === 'offline' ? false : stage.needsNetwork;
        return {
            index,
            needsNetwork: stageNeedsNetwork,
            command: stage.command,
            containerName: stageContainerName,
            networkName: stageNetworkName,
            networkConfiguration: {
                Name: stageNetworkName,
                Driver: 'bridge',
                CheckDuplicate: true,
                // Only dependency installs need outbound network access. Script/build
                // stages stay on an internal network so package scripts cannot call home.
                // Offline mode forces every stage internal.
                Internal: !stageNeedsNetwork,
                Attachable: false,
                Labels: labels,
                Options: { 'com.docker.network.bridge.enable_icc': 'false' }
            },
            containerConfiguration: {
                Image: process.env.PROJECT_RUNTIME_IMAGE || 'ccfwp-platform:dev',
                Cmd: ['/bin/sh', '-lc', stage.command],
                WorkingDir: '/workspace',
                User: `${RUNTIME_UID}:${RUNTIME_GID}`,
                Env: minimalBuildEnvironment(),
                Labels: {
                    ...labels,
                    'io.ccfwp.build-stage': String(index + 1),
                    'io.ccfwp.build-network': stage.needsNetwork ? 'external' : 'internal'
                },
                HostConfig: {
                    NetworkMode: stageNetworkName,
                    ReadonlyRootfs: true,
                    Privileged: false,
                    CapDrop: ['ALL'],
                    SecurityOpt: ['no-new-privileges:true'],
                    PidsLimit: project.limits.pids,
                    Memory: project.limits.memoryMb * 1024 * 1024,
                    MemorySwap: project.limits.memoryMb * 1024 * 1024,
                    NanoCpus: Math.round(project.limits.cpu * 1_000_000_000),
                    OomKillDisable: false,
                    Init: true,
                    AutoRemove: false,
                    Mounts: [{
                        Type: 'bind',
                        Source: hostPath(absoluteWorkDirectory),
                        Target: '/workspace',
                        ReadOnly: false
                    }],
                    Tmpfs: { '/tmp': `rw,noexec,nosuid,nodev,size=64m,uid=${RUNTIME_UID},gid=${RUNTIME_GID},mode=0700` },
                    LogConfig: { Type: 'json-file', Config: { 'max-size': '10m', 'max-file': '3' } }
                },
                NetworkingConfig: {
                    EndpointsConfig: { [stageNetworkName]: { Aliases: [stageContainerName] } }
                }
            }
        };
    });

    // Keep a representative top-level container/network configuration for callers and tests.
    const primary = stages[0];
    return {
        runtimeKey,
        containerName,
        networkName: primary.networkName,
        labels,
        workDirectory: absoluteWorkDirectory,
        diskLimitBytes: project.limits.diskMb * 1024 * 1024,
        sanitizedCommand: plan.sanitized,
        needsNetwork: networkMode === 'offline' ? false : plan.needsNetwork,
        networkMode,
        registry: resolveBuildRegistry(),
        stages,
        networkConfiguration: primary.networkConfiguration,
        containerConfiguration: primary.containerConfiguration
    };
}

module.exports = {
    INSPECTOR_PORT,
    OWNER_LABEL,
    RUNTIME_GID,
    RUNTIME_PORT,
    RUNTIME_UID,
    buildValidatedShellCommand,
    createDockerBuildSpec,
    createDockerRuntimeSpec,
    hostPath,
    makeWritableTree,
    minimalBuildEnvironment,
    normalizeRegistryUrl,
    resolveBuildNetworkMode,
    resolveBuildRegistry,
    safeRuntimeSuffix
};
