const { exec } = require('child_process');

/**
 * Kill process occupying the specified port
 * @param {number} port 
 * @returns {Promise<void>}
 */
function killPort(port) {
    return new Promise((resolve, reject) => {
        if (!port) return resolve();

        // Command for Mac/Linux to find PID on port
        const findCmd = `lsof -t -i:${port}`;

        exec(findCmd, (err, stdout) => {
            if (err || !stdout) {
                // No process found on this port, or error (lsof returns exit code 1 if empty)
                return resolve();
            }

            const pids = stdout.trim().split('\n').filter(pid => pid);
            if (pids.length === 0) return resolve();

            console.log(`[PortKiller] Killing processes on port ${port}: ${pids.join(', ')}`);

            // Kill PID
            const killCmd = `kill -9 ${pids.join(' ')}`;
            exec(killCmd, (kErr) => {
                if (kErr) {
                    console.warn(`[PortKiller] Failed to kill PID ${pids.join(' ')}: ${kErr.message}`);
                    // Resolve anyway, maybe permissions issue but we tried
                }
                resolve();
            });
        });
    });
}

module.exports = killPort;
