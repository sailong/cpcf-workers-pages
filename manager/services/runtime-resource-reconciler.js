'use strict';

async function reconcileResourceDeletion(deleted, dependencies) {
    const { runtime, projectService, updateResources, logger = console } = dependencies;
    await updateResources();

    const failures = [];
    let restarted = 0;
    for (const projectId of deleted.affectedProjectIds || []) {
        const project = projectService.getById(projectId);
        if (!project) continue;
        const shouldRestart = project.status === 'running' || runtime.isRunning(projectId);
        await runtime.stop(projectId);
        if (!shouldRestart) continue;
        try {
            await runtime.start(project);
            restarted++;
        } catch (error) {
            projectService.update(projectId, { status: 'stopped' });
            failures.push({ projectId, error: error.message });
            logger.error(`[Runtime] Project ${projectId} stayed stopped after resource revocation:`, error);
        }
    }

    return { restarted, failures };
}

module.exports = { reconcileResourceDeletion };
