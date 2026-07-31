'use strict';
const config = require('../config');
const resourceService = require('./resource-service');
const projectService = require('./project-service');
const { RuntimeBroker } = require('./runtime-broker');
const resourceRuntime = require('./resource-runtime');
const resourceGateway = require('./resource-gateway-server');
const fs = require('node:fs');
const { directorySize } = require('./docker-runtime-provider');
const { resolveWithin } = require('../utils/path-helper');
const { reconcileResourceDeletion: reconcileDeletedResource } = require('./runtime-resource-reconciler');

// Initialize Runtime
const runtime = new RuntimeBroker(config.UPLOADS_DIR, resourceService.getAll());
let observabilityTimer = null;
let collectingObservability = false;

async function collectObservability() {
    if (collectingObservability) return;
    collectingObservability = true;
    try {
        await runtime.collectObservability();
    } finally {
        collectingObservability = false;
    }
}

function startObservability() {
    if (observabilityTimer) return;
    void collectObservability();
    observabilityTimer = setInterval(() => void collectObservability(), 5_000);
    observabilityTimer.unref();
}

function stopObservability() {
    if (!observabilityTimer) return;
    clearInterval(observabilityTimer);
    observabilityTimer = null;
}

function getProjectMetrics(project, concurrentRequests = 0) {
    const live = runtime.getMetrics(project.id);
    const projectRoot = resolveWithin(config.PROJECTS_DIR, project.id);
    const storageBytes = fs.existsSync(projectRoot) ? directorySize(projectRoot) : 0;
    return {
        supported: runtime.providerName === 'docker',
        running: runtime.isRunning(project.id),
        cpuPercent: live?.cpuPercent ?? null,
        memoryBytes: live?.memoryBytes ?? null,
        memoryLimitBytes: live?.memoryLimitBytes || project.limits.memoryMb * 1024 * 1024,
        pids: live?.pids ?? null,
        storageBytes,
        storageLimitBytes: project.limits.diskMb * 1024 * 1024,
        concurrentRequests,
        concurrencyLimit: project.limits.concurrentRequests,
        collectedAt: live?.collectedAt || null
    };
}

/**
 * Start the canonical resource runtime before restoring project runtimes.
 */
async function startAll() {
    await resourceRuntime.start(resourceService.getAllIncludingDeleted());
    try {
        await resourceGateway.start();
        const capabilities = await runtime.assertReady();
        console.log(`[Runtime] Provider ready: ${capabilities.provider}`);
        const projects = projectService.getAll();

        const startPromises = projects
            .filter(project => project.status === 'running')
            .map(async project => {
                console.log(`[Auto-Start] Restoring project ${project.name}...`);

                if (!project.port) {
                    try {
                        project = projectService.update(project.id, { port: await projectService.getAvailablePort() });
                    } catch (error) {
                        console.error(`[Auto-Start] Failed to assign port for ${project.name}: ${error.message}`);
                        projectService.update(project.id, { status: 'stopped' });
                        return;
                    }
                }

                try {
                    const portCheck = await projectService.isPortAvailable(project.port, project.id);
                    if (!portCheck.valid) throw new Error(portCheck.error);
                    await runtime.start(project);
                } catch (error) {
                    console.error(`[Auto-Start] Failed to start ${project.name}:`, error);
                    projectService.update(project.id, { status: 'stopped' });
                }
            });

        await Promise.allSettled(startPromises);
        startObservability();
    } catch (error) {
        await resourceGateway.stop().catch(() => {});
        await resourceRuntime.dispose().catch(() => {});
        throw error;
    }
}

async function stopAll() {
    stopObservability();
    await collectObservability();
    await runtime.stopAll();
    await resourceGateway.stop();
    await resourceRuntime.dispose();
}

/**
 * Update runtime resources reference when they change
 */
async function updateResources() {
    const freshRef = resourceService.getAll();
    runtime.resources = freshRef;
    await resourceRuntime.sync(resourceService.getAllIncludingDeleted());
}

/**
 * Remove a deleted resource from every live process. A failed restart leaves
 * the project stopped, which is preferable to retaining a revoked binding.
 */
async function reconcileResourceDeletion(deleted, dependencies = {}) {
    return reconcileDeletedResource(deleted, {
        runtime: dependencies.runtime || runtime,
        projectService: dependencies.projectService || projectService,
        updateResources: dependencies.updateResources || updateResources,
    });
}

module.exports = {
    runtime,
    resourceRuntime,
    resourceGateway,
    startAll,
    stopAll,
    updateResources,
    reconcileResourceDeletion,
    getProjectMetrics
};
