'use strict';
const path = require('path');
const config = require('../config');
const resourceService = require('./resource-service');
const projectService = require('./project-service');
const ProjectRuntime = require('../utils/spawner');
const R2AdminManager = require('../utils/r2-admin-manager');
const killPort = require('../utils/port-killer');

// Initialize Runtime
const runtime = new ProjectRuntime(config.UPLOADS_DIR, resourceService.getAll());

// Initialize R2 Admin
const R2_PORT = process.env.R2_ADMIN_PORT || 9099;
const r2Admin = new R2AdminManager(path.join(__dirname, '../system-workers/r2-admin'), resourceService.getAll(), R2_PORT);

/**
 * Restart running projects and System Worker on boot
 */
async function startAll() {
    const projects = projectService.getAll();
    for (const p of projects) {
        if (p.status === 'running') {
            console.log(`[Auto-Start] Restoring project ${p.name}...`);

            // Fix legacy projects without port
            if (!p.port) {
                try {
                    console.log(`[Auto-Start] Project ${p.name} has no port, assigning internal port...`);
                    p.port = await projectService.getAvailablePort();
                    projectService.save();
                } catch (e) {
                    console.error(`[Auto-Start] Failed to assign port for ${p.name}: ${e.message}`);
                    p.status = 'stopped';
                    projectService.save();
                    continue;
                }
            }

            try {
                // Always attempt to release port before starting
                // This prevents issues where isSystemPortInUse might return false negatives (e.g. ipv6/ipv4 mismatch)
                // or if a zombie process is holding the port.
                try {
                    console.log(`[Auto-Start] Ensuring port ${p.port} is free for ${p.name}...`);
                    await killPort(p.port);
                } catch (e) {
                    console.warn(`[Auto-Start] Kill port error: ${e.message}`);
                }

                await runtime.start(p);
            } catch (e) {
                console.error(`[Auto-Start] Failed to start ${p.name}:`, e);
                p.status = 'stopped';
                projectService.save();
            }
        }
    }
    r2Admin.start();
}

/**
 * Update runtime resources reference when they change
 */
function updateResources() {
    const freshRef = resourceService.getAll();
    runtime.resources = freshRef;
    // Note: R2 Admin might need explicit restart if R2 buckets changed
}

module.exports = {
    runtime,
    r2Admin,
    startAll,
    updateResources
};
