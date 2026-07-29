const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { generateConfig } = require('./generator');
const { resolveWithin } = require('./path-helper');
const cryptoHelper = require('./crypto-helper');

class ProjectRuntime {
    constructor(uploadsDir, resources = { kv: [], d1: [] }) {
        this.processes = new Map(); // projectId -> ChildProcess
        this.uploadsDir = uploadsDir;
        this.resources = resources;
    }

    /**
     * Start a project
     * @param {Object} project 
     * @returns {Promise<void>}
     */
    async start(project) {
        if (this.processes.has(project.id)) {
            console.log(`Project ${project.name} is already running.`);
            return;
        }

        console.log(`Starting project ${project.name} on port ${project.port}...`);

        // Determine command and args based on project type
        let cmd = 'npx';
        let args = ['wrangler'];
        let cwd = this.uploadsDir;

        if (project.type === 'pages') {
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

            // Sync KV Data before starting
            await this.seedKV(project, cwd);

            // Add bindings via CLI for Pages
            // ...
            // KV Bindings
            if (project.bindings && project.bindings.kv && project.bindings.kv.length > 0) {
                project.bindings.kv.forEach(binding => {
                    const kvResource = this.resources.kv.find(r => r.id === binding.resourceId);
                    if (kvResource) {
                        args.push('--kv', `${binding.varName}=${kvResource.id}`);
                    }
                });
            }

            // D1 Bindings
            if (project.bindings && project.bindings.d1 && project.bindings.d1.length > 0) {
                project.bindings.d1.forEach(binding => {
                    const d1Resource = this.resources.d1.find(r => r.id === binding.resourceId);
                    if (d1Resource) {
                        args.push('--d1', `${binding.varName}=${d1Resource.id}`);
                    }
                });
            }

            // R2 Bindings
            if (project.bindings && project.bindings.r2 && project.bindings.r2.length > 0) {
                project.bindings.r2.forEach(binding => {
                    const r2Resource = this.resources.r2.find(r => r.id === binding.resourceId);
                    if (r2Resource) {
                        args.push('--r2', `${binding.varName}=${r2Resource.name}`);
                    }
                });
            }

            // 环境变量 (envVars) - 通过 --binding 参数传递
            if (project.envVars && Object.keys(project.envVars).length > 0) {
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

            // Force shared persistence so Pages see the same D1 data
            const sharedStateDir = path.join(path.dirname(this.uploadsDir), 'wrangler-shared-state');
            args.push('--persist-to', sharedStateDir);

            // Port and IP
            args.push('--port', project.port.toString());
            args.push('--ip', '0.0.0.0');

            // Compatibility Flags
            args.push('--compatibility-date', '2024-09-23');
            args.push('--compatibility-flags', 'nodejs_compat');

            // Unique Inspector Port to avoid conflicts
            args.push('--inspector-port', (project.port + 10000).toString());

        } else {
            // For Workers: wrangler dev <file> --config <toml>
            const configContent = generateConfig(project, this.resources);
            const configPath = resolveWithin(this.uploadsDir, `${project.id}.toml`);
            fs.writeFileSync(configPath, configContent);

            args.push('dev', project.mainFile);
            args.push('--config', configPath);
            args.push('--port', project.port.toString());
            args.push('--ip', '0.0.0.0');

            // Unique Inspector Port to avoid conflicts
            args.push('--inspector-port', (project.port + 10000).toString());

            // Force shared persistence so all workers supply the same DBs
            const sharedStateDir = path.join(path.dirname(this.uploadsDir), 'wrangler-shared-state');
            args.push('--persist-to', sharedStateDir);
        }

        // Spawn process
        const child = spawn(cmd, args, {
            cwd: cwd,
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        child.stdout.on('data', (data) => {
            console.log(`[${project.name}] ${data}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`[${project.name}] ${data}`);
        });

        child.on('close', (code) => {
            console.log(`[${project.name}] Process exited with code ${code}`);
            this.processes.delete(project.id);
        });

        this.processes.set(project.id, { child, port: project.port });
    }

    /**
     * Stop a project
     * @param {string} projectId 
     */
    stop(projectId) {
        const processData = this.processes.get(projectId);
        if (processData) {
            const { child, port } = processData;

            console.log(`[Runtime] Stopping project ${projectId} on port ${port}...`);

            // 1. Try graceful kill (SIGTERM)
            if (child && !child.killed) {
                child.kill('SIGTERM');
            }

            // 2. Force kill any process on this port (Zombie cleanup)
            // Since we are stopping the project that OWNS this port, this is safe and necessary
            // because npx/wrangler often leaves subprocesses running.
            if (port) {
                try {
                    const { execSync } = require('child_process');
                    // fuser -k <port>/tcp kills processes on that port
                    // -k: kill, -s: silent (optional, but we want logs if it fails?)
                    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
                    console.log(`[Runtime] Force-freed port ${port}`);
                } catch (e) {
                    // Ignore error (exit code 1 means no process found to kill, which is good)
                }
            }

            this.processes.delete(projectId);
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
            const { spawn } = require('child_process');
            const seedChild = spawn('npx', ['wrangler', 'dev', `seeder-${seedId}.js`, '--config', `seeder-${seedId}.toml`, '--port', port.toString()], {
                cwd,
                env: { ...process.env, FORCE_COLOR: '1' }
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
                try {
                    process.kill(seedChild.pid, 'SIGTERM');
                    // Force kill if needed? logic for spawner.js tracks pids, but this is temp.
                    // Just emit sigtikill slightly later if needed?
                    // Usually wrangler dev dies on sigterm.
                } catch (e) { }

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
