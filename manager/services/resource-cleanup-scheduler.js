'use strict';

function startResourceCleanupScheduler(options) {
    const {
        resourceService,
        runtimeService,
        intervalMs = 60 * 60 * 1000,
        setIntervalFn = setInterval,
        logger = console
    } = options;

    const run = async () => {
        const purged = await resourceService.purgeExpired();
        if (purged.length) {
            await runtimeService.updateResources();
        }
        return purged;
    };
    const safelyRun = label => run().catch(error => logger.error(`[Resource Cleanup] ${label} purge failed:`, error));

    void safelyRun('Startup');
    const timer = setIntervalFn(() => void safelyRun('Scheduled'), intervalMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
    return { run, timer };
}

module.exports = { startResourceCleanupScheduler };
