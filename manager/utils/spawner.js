const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { generateConfig } = require('./generator');

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
            // For Pages: wrangler pages dev <directory>
            args.push('pages', 'dev', project.mainFile);

            // Add bindings via CLI for Pages (simpler than config file)
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
            const configPath = path.join(this.uploadsDir, `${project.id}.toml`);
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

        this.processes.set(project.id, child);
    }

    /**
     * Stop a project
     * @param {string} projectId 
     */
    stop(projectId) {
        const child = this.processes.get(projectId);
        if (child) {
            child.kill('SIGTERM');
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
}

module.exports = ProjectRuntime;
