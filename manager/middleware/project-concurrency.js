'use strict';

function createProjectConcurrencyGate() {
    const inFlight = new Map();

    function acquire(project, req, res) {
        const limit = project.limits.concurrentRequests;
        const current = inFlight.get(project.id) || 0;
        if (current >= limit) {
            res.setHeader('Retry-After', '1');
            res.status(429).send('Project request concurrency limit exceeded');
            return false;
        }

        inFlight.set(project.id, current + 1);
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            const remaining = (inFlight.get(project.id) || 1) - 1;
            if (remaining <= 0) inFlight.delete(project.id);
            else inFlight.set(project.id, remaining);
        };
        res.once('finish', release);
        res.once('close', release);
        req.once('aborted', release);
        return true;
    }

    return { acquire, count: projectId => inFlight.get(projectId) || 0 };
}

const projectConcurrencyGate = createProjectConcurrencyGate();

module.exports = { createProjectConcurrencyGate, projectConcurrencyGate };
