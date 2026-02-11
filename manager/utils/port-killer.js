const { exec } = require('child_process');

/**
 * Kill process occupying the specified port
 * @param {number} port 
 * @returns {Promise<void>}
 */
function killPort(port) {
    return new Promise(async (resolve, reject) => {
        if (!port) return resolve();

        const findCmd = `lsof -t -i:${port}`;

        // Helper to check if port is still used
        const checkPort = () => {
            return new Promise(r => {
                exec(findCmd, (err, stdout) => {
                    if (err || !stdout || !stdout.trim()) return r([]);
                    const pids = stdout.trim().split('\n').filter(pid => pid);
                    r(pids);
                });
            });
        };

        let pids = await checkPort();
        if (pids.length === 0) return resolve();

        console.log(`[PortKiller] Killing processes on port ${port}: ${pids.join(', ')}`);

        // Kill -9
        const killCmd = `kill -9 ${pids.join(' ')}`;

        // Execute kill
        await new Promise(r => exec(killCmd, r));

        // Wait for release (max 5 seconds)
        let retries = 0;
        while (retries < 20) {
            await new Promise(r => setTimeout(r, 250)); // Wait 250ms
            pids = await checkPort();
            if (pids.length === 0) {
                console.log(`[PortKiller] Port ${port} released successfully.`);
                return resolve();
            }
            retries++;
        }

        console.warn(`[PortKiller] Failed to release port ${port} after 5s. PIDs remaining: ${pids.join(', ')}`);
        // Try kill again?
        // For now, resolve but warn.
        resolve();
    });
}

module.exports = killPort;
