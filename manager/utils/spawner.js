const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('node:crypto');
const config = require('../config');
const { generateConfig } = require('./generator');
const { createResourceBindingShim } = require('./resource-binding-shim');
const { tokenForProject } = require('../services/resource-gateway-auth');
const { resolveWithin } = require('./path-helper');
const cryptoHelper = require('./crypto-helper');
const { getWranglerCommand } = require('./wrangler-command');
const { isReleasePath, resolveProjectPath } = require('./project-paths');
const { createRuntimeEnvironment } = require('./runtime-environment');
const { normalizeProjectCompatibility } = require('../services/project-compatibility');
const runtimeLogs = require('../services/runtime-log-service');

function terminateManagedProcess(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const signal = (name) => {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, name);
        else child.kill(name);
    };
    try {
        signal('SIGTERM');
    } catch {
        return;
    }
    const forceTimer = setTimeout(() => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        try { signal('SIGKILL'); } catch { }
    }, 2_000);
    forceTimer.unref();
}

function getInspectorPort(port) {
    const runtimePort = Number(port);
    if (!Number.isInteger(runtimePort) || runtimePort < 1 || runtimePort > 65535) {
        throw new Error(`Invalid project runtime port: ${port}`);
    }

    return runtimePort <= 55535 ? runtimePort + 10000 : runtimePort - 10000;
}

function runManagedCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: createRuntimeEnvironment(options.env),
            detached: process.platform !== 'win32'
        });
        const output = [];
        let settled = false;
        const capture = chunk => {
            output.push(chunk);
            if (output.reduce((size, item) => size + item.length, 0) > 64 * 1024) output.shift();
        };
        child.stdout.on('data', capture);
        child.stderr.on('data', capture);
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            terminateManagedProcess(child);
            reject(new Error(`Pages Functions build timed out after ${options.timeoutMs}ms`));
        }, options.timeoutMs);
        timer.unref();
        child.once('error', error => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
        });
        child.once('close', code => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code === 0) return resolve();
            const detail = Buffer.concat(output).toString('utf8').trim();
            reject(new Error(`Pages Functions build failed with code ${code}${detail ? `: ${detail}` : ''}`));
        });
    });
}

function copyPagesAssets(source, destination) {
    fs.rmSync(destination, { recursive: true, force: true });
    fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
    fs.cpSync(source, destination, {
        recursive: true,
        filter: current => {
            const relative = path.relative(source, current);
            if (!relative) return true;
            const [first] = relative.split(path.sep);
            return first !== 'functions' && relative !== '_worker.js';
        }
    });
}

function preparePagesReleaseWorkspace(source, controlDirectory) {
    const workspace = resolveWithin(controlDirectory, 'source');
    fs.rmSync(controlDirectory, { recursive: true, force: true });
    fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
    fs.cpSync(source, workspace, { recursive: true, force: false, errorOnExist: true });
    return workspace;
}

class ProjectRuntime {
    constructor(uploadsDir, resources = { kv: [], d1: [] }, options = {}) {
        this.processes = new Map(); // projectId -> ChildProcess
        this.uploadsDir = uploadsDir;
        this.resources = resources;
        this.logService = options.logService || runtimeLogs;
    }

    appendLog(projectId, stream, content) {
        try {
            this.logService.append(projectId, stream, content);
            return true;
        } catch (error) {
            console.error(`[Runtime] Failed to persist ${stream} log for project ${projectId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Start a project
     * @param {Object} project 
     * @returns {Promise<void>}
     */
    async start(project, options = {}) {
        const runtimeKey = options.runtimeKey || project.id;
        if (this.processes.has(runtimeKey)) {
            console.log(`Project ${project.name} is already running.`);
            return;
        }

        console.log(`Starting project ${project.name} on port ${project.port}...`);

        // Determine command and args based on project type
        const wrangler = getWranglerCommand();
        let cmd = wrangler.command;
        let args = [...wrangler.args];
        let cwd = this.uploadsDir;
        let controlDirectory = null;
        let usesGatewayPages = false;
        const { compatibilityDate, compatibilityFlags } = normalizeProjectCompatibility(project);

        if (project.type === 'pages') {
            if (isReleasePath(project.mainFile)) {
                const releaseDirectory = resolveProjectPath(project.mainFile);
                const suffix = crypto.createHash('sha256').update(runtimeKey).digest('hex').slice(0, 20);
                controlDirectory = resolveWithin(config.RUNTIME_CONTROL_DIR, suffix);
                cwd = preparePagesReleaseWorkspace(releaseDirectory, controlDirectory);
                const functionsDirectory = path.join(cwd, 'functions');
                const customWorker = path.join(cwd, '_worker.js');
                const hasFunctions = fs.existsSync(functionsDirectory) && fs.statSync(functionsDirectory).isDirectory();
                const hasCustomWorker = fs.existsSync(customWorker) && fs.statSync(customWorker).isFile();

                if (hasFunctions || hasCustomWorker) {
                    usesGatewayPages = true;
                    let workerEntry = customWorker;
                    if (hasFunctions) {
                        const workerDirectory = resolveWithin(controlDirectory, 'pages-worker');
                        workerEntry = resolveWithin(workerDirectory, 'index.js');
                        await runManagedCommand(wrangler.command, [
                            ...wrangler.args,
                            'pages', 'functions', 'build', functionsDirectory,
                            '--outdir', workerDirectory
                        ], {
                            cwd,
                            env: { FORCE_COLOR: '0', NO_COLOR: '1' },
                            timeoutMs: (project.limits?.buildTimeoutSeconds || 600) * 1000
                        });
                    }

                    const wrapperPath = resolveWithin(controlDirectory, 'entry.mjs');
                    const configPath = resolveWithin(controlDirectory, 'wrangler.toml');
                    const assetsDirectory = resolveWithin(controlDirectory, 'assets');
                    copyPagesAssets(cwd, assetsDirectory);
                    fs.writeFileSync(wrapperPath, createResourceBindingShim(project, {
                        entry: workerEntry,
                        gatewayUrl: `http://127.0.0.1:${config.RESOURCE_GATEWAY_PORT}`,
                        token: tokenForProject(project.id)
                    }), { mode: 0o600 });
                    fs.writeFileSync(configPath, generateConfig({
                        ...project,
                        type: 'worker',
                        mainFile: wrapperPath
                    }, this.resources, {
                        includeResourceBindings: false,
                        assetsDirectory,
                        assetsBinding: 'ASSETS',
                        runWorkerFirst: true
                    }), { mode: 0o600 });
                    args.push('dev', wrapperPath, '--config', configPath);
                    console.log(`[Runtime] Dynamic Pages release ${project.name}: CWD=${cwd}`);
                } else {
                    args.push('pages', 'dev', '.');
                    console.log(`[Runtime] Static Pages release ${project.name}: CWD=${cwd}`);
                }
            } else {
            // Logic to determine Project Root (where functions/ or _worker.js might be)
            // and Static Assets Dir (which is passed to 'wrangler pages dev [DIR]')

            // 1. Build Flow (Source Directory Exists)
            const projectRootRel = path.dirname(project.mainFile);
            const sourceDir = resolveWithin(this.uploadsDir, path.join(projectRootRel, 'source'));

            if (fs.existsSync(sourceDir)) {
                cwd = sourceDir;
                // For Build projects, user defines outputDir (e.g. 'dist')
                // If outputDir is empty or '.', we use '.'
                let targetDirName = project.outputDir || '.';

                // If outputDir is absolute or attempts to escape, sanitize? 
                // Assuming outputDir is relative to sourceDir.

                // Auto-detection within sourceDir if outputDir seems wrong?
                // existing logic kept simple: Use explicit outputDir if provided.

                args.push('pages', 'dev', targetDirName);
                console.log(`[Runtime] Build Project ${project.name}: CWD=${cwd}, Target=${targetDirName}`);

            } else {
                // 2. Direct Upload Flow (Zip or Folder)
                // project.mainFile is likely 'page-name-timestamp' (the extract dir)
                // We initially assume CWD is the extract dir.

                let targetPath = project.mainFile;
                let fullPath = resolveWithin(this.uploadsDir, targetPath);

                // Auto-detect nested project root vs static dir
                // Scenario A: Zip contains [ 'index.html', 'functions/' ] -> CWD = fullPath, Target = '.'
                // Scenario B: Zip contains [ 'dist/index.html', 'functions/' ] -> CWD = fullPath, Target = 'dist'
                // Scenario C: Zip contains [ 'my-app/' ] -> [ 'my-app/index.html', 'my-app/functions/' ] 
                //    -> CWD = fullPath/my-app, Target = '.'

                // Step 1: Check for single top-level folder wrapper (Scenario C)
                if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
                    const items = fs.readdirSync(fullPath).filter(i => !i.startsWith('.'));
                    // If only one folder, and no index.html/functions in root, drill down
                    if (items.length === 1 && fs.statSync(path.join(fullPath, items[0])).isDirectory()) {
                        const subPath = path.join(fullPath, items[0]);
                        // Check if this subfolder looks like a project root
                        if (fs.existsSync(path.join(subPath, 'index.html')) ||
                            fs.existsSync(path.join(subPath, 'functions')) ||
                            fs.existsSync(path.join(subPath, '_worker.js'))) {

                            console.log(`[Runtime] Auto-detected nested root: ${items[0]}`);
                            fullPath = subPath; // Update root
                            // Note: We don't update targetPath string yet, we handle CWD
                        }
                    }
                }

                cwd = fullPath;
                let staticArg = '.';

                // Step 2: Check for specific static directory (Scenario B: dist/ or public/)
                // Only if index.html is NOT in current root
                if (!fs.existsSync(path.join(cwd, 'index.html'))) {
                    const candidates = ['dist', 'public', 'build', 'out'];
                    const found = candidates.find(d => fs.existsSync(path.join(cwd, d, 'index.html')));
                    if (found) {
                        staticArg = found;
                        console.log(`[Runtime] Auto-detected static dir: ${found}`);
                    }
                }

                args.push('pages', 'dev', staticArg);
                console.log(`[Runtime] Direct Upload ${project.name}: CWD=${cwd}, Target=${staticArg}`);
            }
            }

            // Legacy mutable Pages projects retain native bindings until migrated.
            if (!usesGatewayPages) await this.seedKV(project, cwd);

            // Add bindings via CLI for Pages
            // ...
            // KV Bindings
            if (!usesGatewayPages && project.bindings && project.bindings.kv && project.bindings.kv.length > 0) {
                project.bindings.kv.forEach(binding => {
                    const kvResource = this.resources.kv.find(r => r.id === binding.resourceId);
                    if (kvResource) {
                        args.push('--kv', `${binding.varName}=${kvResource.id}`);
                    }
                });
            }

            // D1 Bindings
            if (!usesGatewayPages && project.bindings && project.bindings.d1 && project.bindings.d1.length > 0) {
                project.bindings.d1.forEach(binding => {
                    const d1Resource = this.resources.d1.find(r => r.id === binding.resourceId);
                    if (d1Resource) {
                        args.push('--d1', `${binding.varName}=${d1Resource.id}`);
                    }
                });
            }

            // R2 Bindings
            if (!usesGatewayPages && project.bindings && project.bindings.r2 && project.bindings.r2.length > 0) {
                project.bindings.r2.forEach(binding => {
                    const r2Resource = this.resources.r2.find(r => r.id === binding.resourceId);
                    if (r2Resource) {
                        args.push('--r2', `${binding.varName}=${r2Resource.name}`);
                    }
                });
            }

            // 环境变量 (envVars) - 通过 --binding 参数传递
            if (!usesGatewayPages && project.envVars && Object.keys(project.envVars).length > 0) {
                Object.entries(project.envVars).forEach(([key, varData]) => {
                    let value;
                    if (varData.type === 'json') {
                        // JSON 类型序列化为字符串
                        value = typeof varData.value === 'string'
                            ? varData.value
                            : JSON.stringify(varData.value);
                    } else {
                        // plain 和 secret 类型直接使用值
                        value = varData.type === 'secret'
                            ? cryptoHelper.decryptSecret(varData.value, project.id)
                            : varData.value;
                    }
                    args.push('--binding', `${key}=${value}`);
                });
            }

            const projectStateDir = resolveWithin(config.PROJECT_RUNTIME_STATE_DIR, project.id);
            fs.mkdirSync(projectStateDir, { recursive: true, mode: 0o700 });
            args.push('--persist-to', projectStateDir);

            // Port and IP
            args.push('--port', project.port.toString());
            args.push('--ip', '0.0.0.0');

            args.push('--compatibility-date', compatibilityDate);
            for (const flag of compatibilityFlags) args.push('--compatibility-flag', flag);

            // Unique Inspector Port to avoid conflicts
            args.push('--inspector-port', getInspectorPort(project.port).toString());

        } else {
            const suffix = crypto.createHash('sha256').update(runtimeKey).digest('hex').slice(0, 20);
            controlDirectory = resolveWithin(config.RUNTIME_CONTROL_DIR, suffix);
            fs.rmSync(controlDirectory, { recursive: true, force: true });
            fs.mkdirSync(controlDirectory, { recursive: true, mode: 0o700 });
            const wrapperPath = resolveWithin(controlDirectory, 'entry.mjs');
            const configPath = resolveWithin(controlDirectory, 'wrangler.toml');
            fs.writeFileSync(wrapperPath, createResourceBindingShim(project, {
                entry: resolveProjectPath(project.mainFile),
                gatewayUrl: `http://127.0.0.1:${config.RESOURCE_GATEWAY_PORT}`,
                token: tokenForProject(project.id)
            }), { mode: 0o600 });
            fs.writeFileSync(configPath, generateConfig({ ...project, mainFile: wrapperPath }, this.resources, {
                includeResourceBindings: false
            }), { mode: 0o600 });

            args.push('dev', wrapperPath);
            args.push('--config', configPath);
            args.push('--port', project.port.toString());
            args.push('--ip', '0.0.0.0');

            // Unique Inspector Port to avoid conflicts
            args.push('--inspector-port', getInspectorPort(project.port).toString());

            const projectStateDir = resolveWithin(config.PROJECT_RUNTIME_STATE_DIR, project.id);
            fs.mkdirSync(projectStateDir, { recursive: true, mode: 0o700 });
            args.push('--persist-to', projectStateDir);
        }

        // Spawn process
        const child = spawn(cmd, args, {
            cwd: cwd,
            env: createRuntimeEnvironment({ FORCE_COLOR: '1' }),
            detached: process.platform !== 'win32'
        });

        const persistentObservability = runtimeKey === project.id;
        let resolveClosed;
        const closePromise = new Promise(resolve => { resolveClosed = resolve; });
        const processData = {
            child,
            port: project.port,
            spawnError: null,
            controlDirectory,
            persistentObservability,
            projectId: project.id,
            closePromise
        };

        child.stdout.on('data', (data) => {
            console.log(`[${project.name}] ${data}`);
            if (persistentObservability) this.appendLog(project.id, 'stdout', data.toString());
        });

        child.stderr.on('data', (data) => {
            console.error(`[${project.name}] ${data}`);
            if (persistentObservability) this.appendLog(project.id, 'stderr', data.toString());
        });

        child.on('error', error => {
            processData.spawnError = error;
            console.error(`[${project.name}] Failed to spawn runtime: ${error.message}`);
            if (persistentObservability) this.appendLog(project.id, 'stderr', `Runtime spawn failed: ${error.message}`);
        });

        child.on('close', (code) => {
            console.log(`[${project.name}] Process exited with code ${code}`);
            const current = this.processes.get(runtimeKey);
            if (current && current.child === child) {
                this.processes.delete(runtimeKey);
                if (current.controlDirectory) fs.rmSync(current.controlDirectory, { recursive: true, force: true });
            }
            if (persistentObservability) this.appendLog(project.id, 'system', `Runtime process exited with code ${code}`);
            resolveClosed({ code, signal: child.signalCode });
        });

        this.processes.set(runtimeKey, processData);
        try {
            await this.waitUntilReady(runtimeKey, options.readinessTimeoutMs);
            if (persistentObservability) this.appendLog(project.id, 'system', 'Runtime started');
        } catch (error) {
            await this.stop(runtimeKey);
            throw error;
        }
    }

    async waitUntilReady(runtimeKey, timeoutMs = 20_000) {
        const deadline = Date.now() + timeoutMs;
        let lastError;
        while (Date.now() < deadline) {
            const processData = this.processes.get(runtimeKey);
            if (!processData) throw new Error('Runtime exited before becoming ready');
            if (processData.spawnError) throw processData.spawnError;
            if (processData.child.exitCode !== null) {
                throw new Error(`Runtime exited before becoming ready (code ${processData.child.exitCode})`);
            }
            try {
                await new Promise((resolve, reject) => {
                    const socket = net.createConnection({ host: '127.0.0.1', port: processData.port });
                    socket.setTimeout(300);
                    socket.once('connect', () => {
                        socket.destroy();
                        resolve();
                    });
                    socket.once('timeout', () => {
                        socket.destroy();
                        reject(new Error('connection timed out'));
                    });
                    socket.once('error', reject);
                });
                return;
            } catch (error) {
                lastError = error;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        throw new Error(`Runtime readiness check timed out: ${lastError ? lastError.message : 'unknown error'}`);
    }

    /**
     * Stop a project
     * @param {string} projectId 
     */
    async stop(projectId) {
        const processData = this.processes.get(projectId);
        if (processData) {
            const { child, port } = processData;

            console.log(`[Runtime] Stopping project ${projectId} on port ${port}...`);
            if (processData.persistentObservability) this.appendLog(processData.projectId, 'system', 'Runtime stopping');

            terminateManagedProcess(child);
            let timeoutId;
            try {
                await Promise.race([
                    processData.closePromise,
                    new Promise((_, reject) => {
                        timeoutId = setTimeout(() => reject(new Error(`Runtime ${projectId} did not stop within 5 seconds`)), 5_000);
                        timeoutId.unref();
                    })
                ]);
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
            return true;
        }
        return false;
    }
    /**
     * Check if a project is running
     * @param {string} projectId 
     * @returns {boolean}
     */
    isRunning(projectId) {
        return this.processes.has(projectId);
    }

    /**
     * Seed KV data from JSON to Wrangler Local State
     * @param {Object} project
     * @param {string} cwd
     */
    async seedKV(project, cwd) {
        if (!project.bindings || !project.bindings.kv || project.bindings.kv.length === 0) return;

        // Path to KV JSON data (User managed data)
        const kvDataDir = path.join(path.dirname(this.uploadsDir), 'kv-data');
        let hasData = false;

        // Construct Seeder Worker
        let scriptContent = `export default { async fetch(request, env) { try {`;
        let tomlContent = `name = "seeder-${Date.now()}"\ncompatibility_date = "2024-01-01"\n\n`;

        for (const binding of project.bindings.kv) {
            const resourceId = binding.resourceId;
            const varName = binding.varName;

            const jsonPath = path.join(kvDataDir, `${resourceId}.json`);
            if (fs.existsSync(jsonPath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    const keys = Object.keys(data);

                    if (keys.length > 0) {
                        hasData = true;
                        // Add binding to config
                        tomlContent += `[[kv_namespaces]]\nbinding = "${varName}"\nid = "${resourceId}"\npreview_id = "${resourceId}"\n\n`;

                        // Add put operations to script
                        console.log(`[KV Seed] Found ${keys.length} keys for ${varName} (${resourceId})`);
                        for (const k of keys) {
                            // Serialize value safely. Handles numbers, booleans, strings etc.
                            // KV values are strings. if data[k] is object, JSON stringify it.
                            let val = data[k];
                            // If it's not a string, stringify it because KV put expects string/stream/buffer
                            if (typeof val !== 'string') val = JSON.stringify(val);

                            const keyStr = JSON.stringify(k);
                            const valStr = JSON.stringify(val);
                            scriptContent += `\n      await env.${varName}.put(${keyStr}, ${valStr});`;
                        }
                    }
                } catch (e) {
                    console.error(`[KV Seed] Error reading/parsing ${jsonPath}:`, e.message);
                }
            }
        }

        if (!hasData) return;

        scriptContent += `\n      return new Response("Seeded successfully"); \n    } catch(e) { return new Response(e.stack, {status: 500}); } } };`;

        console.log(`[KV Seed] Starting Seeder Worker...`);

        const seedId = Date.now();
        const scriptPath = path.join(cwd, `seeder-${seedId}.js`);
        const configPath = path.join(cwd, `seeder-${seedId}.toml`);
        // Random port between 40000-50000
        const port = 40000 + Math.floor(Math.random() * 10000);

        fs.writeFileSync(scriptPath, scriptContent);
        fs.writeFileSync(configPath, tomlContent);

        return new Promise((resolve) => {
            const wrangler = getWranglerCommand();
            const sharedStateDir = path.join(path.dirname(this.uploadsDir), 'wrangler-shared-state');
            const seedChild = spawn(wrangler.command, [
                ...wrangler.args, 'dev', `seeder-${seedId}.js`, '--config', `seeder-${seedId}.toml`,
                '--port', port.toString(), '--inspector-port', String(port + 10000), '--persist-to', sharedStateDir
            ], {
                cwd,
                env: createRuntimeEnvironment({ FORCE_COLOR: '1' }),
                detached: process.platform !== 'win32'
            });

            // Handle logging slightly to confirm it runs
            // seedChild.stdout.on('data', d => console.log(`[Seeder] ${d}`));
            // seedChild.stderr.on('data', d => console.log(`[Seeder] ${d}`));

            // Poll for readiness
            let checks = 0;
            const maxChecks = 30; // 30 seconds max
            const interval = setInterval(async () => {
                checks++;
                try {
                    // Try to trigger the seeder
                    const res = await fetch(`http://127.0.0.1:${port}`);
                    if (res.ok) {
                        const text = await res.text();
                        console.log(`[KV Seed] Response: ${text}`);
                        clearInterval(interval);
                        cleanupAndResolve();
                    } else {
                        const text = await res.text();
                        console.error(`[KV Seed] Error response: ${text}`);
                        if (checks > maxChecks) { clearInterval(interval); cleanupAndResolve(); }
                    }
                } catch (e) {
                    // Connection refused, waiting for Wrangler to start
                    if (checks > maxChecks) {
                        console.error(`[KV Seed] Timeout waiting for seeder to start on port ${port}`);
                        clearInterval(interval);
                        cleanupAndResolve();
                    }
                }
            }, 1000);

            function cleanupAndResolve() {
                // Kill seeder
                terminateManagedProcess(seedChild);

                // Clean files
                // Wait a moment for process to release locks on windows? (Mac is fine)
                try { fs.unlinkSync(scriptPath); fs.unlinkSync(configPath); } catch (e) { }

                console.log(`[KV Seed] Done.`);
                resolve();
            }
        });
    }
}

module.exports = ProjectRuntime;
module.exports.terminateManagedProcess = terminateManagedProcess;
module.exports.getInspectorPort = getInspectorPort;
module.exports.preparePagesReleaseWorkspace = preparePagesReleaseWorkspace;
