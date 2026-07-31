'use strict';

class ProjectOperationCoordinator {
    constructor() {
        this.active = new Map();
    }

    get(projectId) {
        return this.active.get(projectId) || null;
    }

    async run(projectId, kind, operation) {
        const current = this.active.get(projectId);
        if (current) {
            const error = new Error(`Project operation already in progress: ${current.kind}`);
            error.statusCode = 409;
            error.publicMessage = error.message;
            error.activeOperation = current.kind;
            throw error;
        }

        const token = { kind, startedAt: new Date().toISOString() };
        this.active.set(projectId, token);
        try {
            return await operation();
        } finally {
            if (this.active.get(projectId) === token) this.active.delete(projectId);
        }
    }
}

const projectOperationCoordinator = new ProjectOperationCoordinator();

module.exports = { ProjectOperationCoordinator, projectOperationCoordinator };
