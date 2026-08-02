'use strict';

const net = require('node:net');
const fs = require('node:fs');
const { DockerEngineClient, DockerEngineError } = require('./docker-engine-client');
const runtimeLogs = require('./runtime-log-service');
const { abortableDelay, throwIfAborted } = require('../utils/abort');
const {
    OWNER_LABEL,
    RUNTIME_PORT,
    createDockerBuildSpec,
    createDockerRuntimeSpec,
    safeRuntimeSuffix
} = require('./docker-runtime-spec');

function isNotFound(error) {
    return error instanceof DockerEngineError && error.statusCode === 404;
}

function isAlreadyDisconnected(error) {
    if (!(error instanceof DockerEngineError) || error.statusCode !== 500) return false;
    return /\bis not connected to (?:the )?network\b/i.test(`${error.message || ''}\n${error.body || ''}`);
}

function networkContainsContainer(network, containerId) {
    const containers = network?.Containers;
    if (!containers || typeof containers !== 'object') return true;
    const target = String(containerId || '').replace(/^\/+/, '');
    return Object.entries(containers).some(([id, endpoint]) => (
        id === target
        || id.startsWith(target)
        || String(endpoint?.Name || '').replace(/^\/+/, '') === target
    ));
}

function decodeDockerLogs(buffer) {
    if (!Buffer.isBuffer(buffer)) return String(buffer || '');
    const output = [];
    let offset = 0;
    while (offset + 8 <= buffer.length && (buffer[offset] === 1 || buffer[offset] === 2)) {
        const length = buffer.readUInt32BE(offset + 4);
        if (offset + 8 + length > buffer.length) break;
        output.push(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8'));
        offset += 8 + length;
    }
    return output.length ? output.join('') : buffer.toString('utf8');
}

function logDelta(previous, current) {
    if (!current || current === previous) return '';
    if (!previous) return current;
    if (current.startsWith(previous)) return current.slice(previous.length);
    const maxOverlap = Math.min(previous.length, current.length);
    for (let size = maxOverlap; size > 0; size -= 1) {
        if (previous.endsWith(current.slice(0, size))) return current.slice(size);
    }
    return current;
}

function decodeRuntimeMetrics(stats) {
    const cpuUsage = stats?.cpu_stats?.cpu_usage?.total_usage || 0;
    const previousCpuUsage = stats?.precpu_stats?.cpu_usage?.total_usage || 0;
    const systemUsage = stats?.cpu_stats?.system_cpu_usage || 0;
    const previousSystemUsage = stats?.precpu_stats?.system_cpu_usage || 0;
    const onlineCpus = stats?.cpu_stats?.online_cpus || stats?.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
    const cpuDelta = cpuUsage - previousCpuUsage;
    const systemDelta = systemUsage - previousSystemUsage;
    const cache = stats?.memory_stats?.stats?.inactive_file || stats?.memory_stats?.stats?.cache || 0;
    return {
        supported: true,
        cpuPercent: systemDelta > 0 && cpuDelta >= 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0,
        memoryBytes: Math.max(0, (stats?.memory_stats?.usage || 0) - cache),
        memoryLimitBytes: stats?.memory_stats?.limit || 0,
        pids: stats?.pids_stats?.current || 0,
        collectedAt: new Date().toISOString()
    };
}

function directorySize(root, stopAfter = Infinity) {
    let total = 0;
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        const stat = fs.lstatSync(current);
        total += stat.size;
        if (total > stopAfter) return total;
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
            for (const name of fs.readdirSync(current)) pending.push(require('node:path').join(current, name));
        }
    }
    return total;
}

class DockerRuntimeProvider {
    constructor(options = {}) {
        this.engine = options.engine || new DockerEngineClient(options);
        this.resources = options.resources || { kv: [], d1: [], r2: [] };
        this.managerContainerId = options.managerContainerId || process.env.MANAGER_CONTAINER_ID || process.env.HOSTNAME;
        this.processes = new Map();
        this.createSpec = options.createSpec || createDockerRuntimeSpec;
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

    async assertReady() {
        await this.engine.ping();
        const [version, info] = await Promise.all([this.engine.version(), this.engine.info()]);
        const securityOptions = info.SecurityOptions || [];
        if (!securityOptions.some(option => String(option).includes('seccomp'))) {
            throw new Error('Docker Engine must provide seccomp isolation');
        }
        if (!info.CgroupVersion) throw new Error('Docker Engine must provide cgroup resource controls');
        if (!this.managerContainerId) throw new Error('MANAGER_CONTAINER_ID is required for isolated runtime networking');
        const manager = await this.engine.inspectContainer(this.managerContainerId);
        if (!manager?.Id) throw new Error('Manager container cannot be inspected by Runtime Broker');
        const image = process.env.PROJECT_RUNTIME_IMAGE || 'ccfwp-platform:dev';
        await this.engine.inspectImage(image);
        return {
            provider: 'docker',
            engineVersion: version.Version,
            cgroupVersion: info.CgroupVersion,
            storageDriver: info.Driver,
            securityOptions
        };
    }

    async start(project, options = {}) {
        const runtimeKey = options.runtimeKey || project.id;
        if (this.processes.has(runtimeKey)) return;

        const spec = this.createSpec(project, this.resources, options);
        await this.cleanup(runtimeKey);
        let containerId = null;
        let networkId = null;
        try {
            const network = await this.engine.createNetwork(spec.networkConfiguration);
            networkId = network.Id;
            await this.engine.connectNetwork(networkId, this.managerContainerId, [`ccfwp-manager-${safeRuntimeSuffix(runtimeKey)}`]);
            const container = await this.engine.createContainer(spec.containerName, spec.containerConfiguration);
            containerId = container.Id;
            this.processes.set(runtimeKey, {
                ...spec,
                containerId,
                networkId,
                projectId: project.id,
                persistentObservability: runtimeKey === project.id,
                logSnapshot: '',
                metrics: null
            });
            await this.engine.startContainer(containerId);
            await this.waitUntilReady(runtimeKey, options.readinessTimeoutMs || spec.startupTimeoutMs);
            if (runtimeKey === project.id) this.appendLog(project.id, 'system', 'Runtime started');
        } catch (error) {
            if (runtimeKey === project.id) this.appendLog(project.id, 'stderr', `Runtime start failed: ${error.message}`);
            this.processes.delete(runtimeKey);
            await this.cleanupIdentifiers({
                containerId: containerId || spec.containerName,
                networkId: networkId || spec.networkName,
                controlDirectory: spec.controlDirectory
            });
            throw error;
        }
    }

    async waitUntilReady(runtimeKey, timeoutMs = 30_000) {
        const deadline = Date.now() + timeoutMs;
        let lastError;
        while (Date.now() < deadline) {
            const runtime = this.processes.get(runtimeKey);
            if (!runtime) throw new Error('Runtime disappeared before becoming ready');
            try {
                const inspection = await this.engine.inspectContainer(runtime.containerId);
                if (!inspection.State?.Running) {
                    const logs = decodeDockerLogs(await this.engine.containerLogs(runtime.containerId));
                    const state = inspection.State || {};
                    const stateDetails = JSON.stringify({
                        status: state.Status,
                        exitCode: state.ExitCode,
                        oomKilled: state.OOMKilled
                    });
                    const details = [logs.trim(), state.Error, stateDetails].filter(Boolean).join('\n');
                    throw new Error(`Runtime exited before becoming ready: ${details}`);
                }
                await new Promise((resolve, reject) => {
                    const socket = net.createConnection({ host: runtime.containerName, port: RUNTIME_PORT });
                    socket.setTimeout(500);
                    socket.once('connect', () => { socket.destroy(); resolve(); });
                    socket.once('timeout', () => { socket.destroy(); reject(new Error('connection timed out')); });
                    socket.once('error', reject);
                });
                return;
            } catch (error) {
                if (/Runtime exited/.test(error.message)) throw error;
                lastError = error;
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        }
        const runtime = this.processes.get(runtimeKey);
        let logs = '';
        if (runtime) {
            try { logs = decodeDockerLogs(await this.engine.containerLogs(runtime.containerId)).trim(); } catch { }
        }
        throw new Error(`Runtime readiness check timed out: ${lastError?.message || 'unknown error'}${logs ? `\n${logs}` : ''}`);
    }

    async cleanup(runtimeKey) {
        const suffix = safeRuntimeSuffix(runtimeKey);
        await this.cleanupIdentifiers({
            containerId: `ccfwp-runtime-${suffix}`,
            networkId: `ccfwp-network-${suffix}`
        });
    }

    async cleanupIdentifiers({ containerId, networkId, controlDirectory, disconnectManager = true }) {
        if (containerId) {
            try {
                const container = await this.engine.inspectContainer(containerId);
                if (container.Config?.Labels?.[OWNER_LABEL] !== 'true') {
                    throw new Error(`Refusing to remove non-broker container ${containerId}`);
                }
                try { await this.engine.stopContainer(container.Id); } catch (error) {
                    if (!isNotFound(error) && error.statusCode !== 304) throw error;
                }
                await this.engine.removeContainer(container.Id);
            } catch (error) {
                if (!isNotFound(error)) throw error;
            }
        }
        if (networkId) {
            try {
                const network = await this.engine.inspectNetwork(networkId);
                if (network.Labels?.[OWNER_LABEL] !== 'true') {
                    throw new Error(`Refusing to remove non-broker network ${networkId}`);
                }
                if (disconnectManager && networkContainsContainer(network, this.managerContainerId)) {
                    try { await this.engine.disconnectNetwork(network.Id, this.managerContainerId); } catch (error) {
                        if (!isNotFound(error) && error.statusCode !== 403 && !isAlreadyDisconnected(error)) throw error;
                    }
                }
                await this.engine.removeNetwork(network.Id);
            } catch (error) {
                if (!isNotFound(error)) throw error;
            }
        }
        if (controlDirectory) fs.rmSync(controlDirectory, { recursive: true, force: true });
    }

    async stop(runtimeKey) {
        const runtime = this.processes.get(runtimeKey);
        if (runtime?.persistentObservability) await this.captureObservability(runtimeKey).catch(() => {});
        this.processes.delete(runtimeKey);
        if (runtime) {
            await this.cleanupIdentifiers(runtime);
            if (runtime.persistentObservability) this.appendLog(runtime.projectId, 'system', 'Runtime stopped');
            return true;
        }
        await this.cleanup(runtimeKey);
        return false;
    }

    async captureObservability(runtimeKey) {
        const runtime = this.processes.get(runtimeKey);
        if (!runtime || !runtime.persistentObservability) return null;
        const [logsResult, statsResult] = await Promise.allSettled([
            this.engine.containerLogs(runtime.containerId, { tail: 500 }),
            this.engine.containerStats(runtime.containerId)
        ]);
        if (logsResult.status === 'fulfilled') {
            const current = decodeDockerLogs(logsResult.value);
            const delta = logDelta(runtime.logSnapshot, current);
            runtime.logSnapshot = current;
            if (delta) this.appendLog(runtime.projectId, 'stdout', delta);
        }
        if (statsResult.status === 'fulfilled') runtime.metrics = decodeRuntimeMetrics(statsResult.value);
        return runtime.metrics;
    }

    async collectObservability() {
        await Promise.allSettled([...this.processes.keys()].map(runtimeKey => this.captureObservability(runtimeKey)));
    }

    getMetrics(runtimeKey) {
        return this.processes.get(runtimeKey)?.metrics || null;
    }

    async runBuild(project, command, options = {}) {
        const spec = createDockerBuildSpec(project, command, options.cwd, options);
        const timeoutMs = options.timeout || project.limits.buildTimeoutSeconds * 1000;
        const deadline = Date.now() + timeoutMs;
        throwIfAborted(options.signal);
        const initialSize = directorySize(spec.workDirectory, spec.diskLimitBytes);
        if (initialSize > spec.diskLimitBytes) {
            throw new Error(`Build workspace exceeds disk limit (${project.limits.diskMb} MB)`);
        }

        for (const stage of spec.stages) {
            let containerId = null;
            let networkId = null;
            try {
                throwIfAborted(options.signal);
                const network = await this.engine.createNetwork(stage.networkConfiguration);
                networkId = network.Id;
                const container = await this.engine.createContainer(stage.containerName, stage.containerConfiguration);
                containerId = container.Id;
                await this.engine.startContainer(containerId);

                let lastDiskCheck = 0;
                let inspection;
                while (Date.now() < deadline) {
                    throwIfAborted(options.signal);
                    inspection = await this.engine.inspectContainer(containerId);
                    if (!inspection.State?.Running) break;
                    if (Date.now() - lastDiskCheck >= 1_000) {
                        lastDiskCheck = Date.now();
                        const size = directorySize(spec.workDirectory, spec.diskLimitBytes);
                        if (size > spec.diskLimitBytes) {
                            throw new Error(`Build workspace exceeded disk limit (${project.limits.diskMb} MB)`);
                        }
                    }
                    await abortableDelay(250, options.signal);
                }
                throwIfAborted(options.signal);
                if (!inspection || inspection.State?.Running) {
                    throw new Error(`Build time limit exceeded (${Math.ceil(timeoutMs / 1000)} seconds)`);
                }
                const logs = decodeDockerLogs(await this.engine.containerLogs(containerId));
                if (logs && options.onStdout) options.onStdout(logs);
                if (inspection.State.ExitCode !== 0) {
                    throw new Error(`Build command failed with exit code ${inspection.State.ExitCode}`);
                }
                const stageSize = directorySize(spec.workDirectory, spec.diskLimitBytes);
                if (stageSize > spec.diskLimitBytes) {
                    throw new Error(`Build workspace exceeded disk limit (${project.limits.diskMb} MB)`);
                }
            } catch (error) {
                if (containerId) {
                    try {
                        const logs = decodeDockerLogs(await this.engine.containerLogs(containerId));
                        if (logs && options.onStderr) options.onStderr(logs);
                    } catch { }
                }
                throw error;
            } finally {
                await this.cleanupIdentifiers({
                    containerId: containerId || stage.containerName,
                    networkId: networkId || stage.networkName,
                    disconnectManager: false
                });
            }
        }

        const finalSize = directorySize(spec.workDirectory, spec.diskLimitBytes);
        if (finalSize > spec.diskLimitBytes) {
            throw new Error(`Build workspace exceeded disk limit (${project.limits.diskMb} MB)`);
        }
        return { success: true, code: 0, stages: spec.stages.length };
    }

    isRunning(runtimeKey) {
        return this.processes.has(runtimeKey);
    }

    getTarget(runtimeKey) {
        return this.processes.get(runtimeKey)?.endpoint || null;
    }
}

module.exports = { DockerRuntimeProvider, decodeDockerLogs, decodeRuntimeMetrics, directorySize, logDelta };
