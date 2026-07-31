'use strict';

const ProjectRuntime = require('../utils/spawner');
const { DockerRuntimeProvider } = require('./docker-runtime-provider');
const { safeShellExec } = require('../utils/safe-exec');
const { planBuildCommand } = require('../utils/build-command-policy');

class ProcessRuntimeProvider {
    constructor(uploadsDir, resources) {
        this.runtime = new ProjectRuntime(uploadsDir, resources);
    }

    get resources() { return this.runtime.resources; }
    set resources(value) { this.runtime.resources = value; }
    get processes() { return this.runtime.processes; }
    async assertReady() {
        if (process.env.NODE_ENV === 'production' && process.env.ALLOW_UNISOLATED_RUNTIME !== 'true') {
            throw new Error('Process runtime is forbidden in production; configure RUNTIME_PROVIDER=docker');
        }
        return { provider: 'process', isolated: false };
    }
    start(project, options) { return this.runtime.start(project, options); }
    async stop(runtimeKey) { return this.runtime.stop(runtimeKey); }
    isRunning(runtimeKey) { return this.runtime.isRunning(runtimeKey); }
    getTarget(runtimeKey) {
        const processData = this.runtime.processes.get(runtimeKey);
        return processData ? `http://127.0.0.1:${processData.port}` : null;
    }
    collectObservability() { return Promise.resolve(); }
    getMetrics() { return null; }
    async runBuild(project, command, options) {
        const plan = planBuildCommand(command, options.cwd || process.cwd(), { networkMode: process.env.BUILD_NETWORK_MODE || 'prefer-offline' });
        let last = null;
        for (const stage of plan.stages) {
            for (const entry of stage.entries) {
                const commandString = [entry.file, ...entry.args.map(arg => {
                    if (!/[\s"']/.test(arg)) return arg;
                    return `"${String(arg).replace(/(["\\])/g, '\\$1')}"`;
                })].join(' ');
                last = await safeShellExec(commandString, {
                    cwd: options.cwd,
                    timeout: options.timeout,
                    signal: options.signal
                }, options.onStdout, options.onStderr);
            }
        }
        return last;
    }
}

class RuntimeBroker {
    constructor(uploadsDir, resources, options = {}) {
        const providerName = options.providerName || process.env.RUNTIME_PROVIDER
            || 'docker';
        if (providerName === 'docker') {
            this.provider = options.provider || new DockerRuntimeProvider({ resources });
        } else if (providerName === 'process') {
            // Process runtime intentionally skips Docker isolation. Require an
            // explicit opt-in in every environment, not only production.
            if (process.env.ALLOW_UNISOLATED_RUNTIME !== 'true' && !options.allowUnisolatedRuntime) {
                throw new Error('Process runtime is disabled by default; set ALLOW_UNISOLATED_RUNTIME=true only for non-isolated debugging');
            }
            this.provider = options.provider || new ProcessRuntimeProvider(uploadsDir, resources);
        } else {
            throw new Error(`Unknown runtime provider: ${providerName}`);
        }
        this.providerName = providerName;
        this.lifecycleTails = new Map();
    }

    get resources() { return this.provider.resources; }
    set resources(value) { this.provider.resources = value; }
    get processes() { return this.provider.processes; }
    assertReady() { return this.provider.assertReady(); }
    withLifecycleLock(runtimeKey, operation) {
        const previous = this.lifecycleTails.get(runtimeKey) || Promise.resolve();
        let release;
        const current = new Promise(resolve => { release = resolve; });
        this.lifecycleTails.set(runtimeKey, current);
        return previous.catch(() => {}).then(operation).finally(() => {
            release();
            if (this.lifecycleTails.get(runtimeKey) === current) this.lifecycleTails.delete(runtimeKey);
        });
    }

    start(project, options = {}) {
        const runtimeKey = options.runtimeKey || project.id;
        return this.withLifecycleLock(runtimeKey, () => this.provider.start(project, options));
    }

    stop(runtimeKey) {
        return this.withLifecycleLock(runtimeKey, () => this.provider.stop(runtimeKey));
    }

    async stopAll() {
        const keys = new Set([...this.processes.keys(), ...this.lifecycleTails.keys()]);
        await Promise.allSettled([...keys].map(key => this.stop(key)));
    }
    isRunning(runtimeKey) { return this.provider.isRunning(runtimeKey); }
    getTarget(runtimeKey) { return this.provider.getTarget(runtimeKey); }
    collectObservability() { return this.provider.collectObservability?.() || Promise.resolve(); }
    getMetrics(runtimeKey) { return this.provider.getMetrics?.(runtimeKey) || null; }
    runBuild(project, command, options) { return this.provider.runBuild(project, command, options); }
}

module.exports = { ProcessRuntimeProvider, RuntimeBroker };
