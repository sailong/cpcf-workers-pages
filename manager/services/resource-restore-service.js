'use strict';

const resourceService = require('./resource-service');
const runtimeService = require('./runtime-service');

async function restoreResource(id, options = {}) {
    const resources = options.resourceService || resourceService;
    const runtime = options.runtimeService || runtimeService;
    const restored = resources.restore(id, options.actor || 'admin');
    if (!restored) return null;

    try {
        await runtime.updateResources();
    } catch (error) {
        error.restoreReverted = resources.rollbackRestore(restored);
        try {
            await runtime.updateResources();
        } catch (rollbackSyncError) {
            error.rollbackSyncError = rollbackSyncError;
        }
        throw error;
    }

    const {
        restoreAuditId: _restoreAuditId,
        deletedAt: _deletedAt,
        purgeAfter: _purgeAfter,
        ...resource
    } = restored;
    return resource;
}

module.exports = { restoreResource };
