'use strict';

const projectService = require('./project-service');

function rollbackChanges(project, changes) {
    return Object.fromEntries(Object.keys(changes).map(key => [key, project[key]]));
}

async function applyProjectUpdate(project, changes, options = {}) {
    const projects = options.projectService || projectService;
    const runtime = options.runtime;
    const needsRestart = Boolean(options.needsRestart);
    const wasRunning = project.status === 'running' || Boolean(runtime?.isRunning?.(project.id));
    const updatedProject = projects.update(project.id, changes);
    if (!updatedProject || !needsRestart || !wasRunning) {
        return { project: updatedProject, restarted: false, reverted: false };
    }

    try {
        await runtime.stop(project.id);
        await runtime.start(updatedProject);
        return { project: updatedProject, restarted: true, reverted: false };
    } catch (error) {
        const restoredProject = projects.update(project.id, rollbackChanges(project, changes));
        try {
            await runtime.start(restoredProject);
            projects.update(project.id, { status: 'running' });
            error.updateReverted = true;
        } catch (rollbackError) {
            projects.update(project.id, { status: 'stopped' });
            error.updateReverted = false;
            error.rollbackError = rollbackError;
        }
        throw error;
    }
}

module.exports = { applyProjectUpdate, rollbackChanges };
