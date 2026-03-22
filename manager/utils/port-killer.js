const { exec } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

/**
 * Kill process occupying the specified port (Cross-platform)
 * @param {number} port 
 * @returns {Promise<void>}
 */
function killPort(port) {
    return new Promise(async (resolve, reject) => {
        if (!port) return resolve();

        console.log(`[PortKiller] Attempting to free port ${port} on ${isWindows ? 'Windows' : 'Unix'}...`);

        try {
            if (isWindows) {
                await killPortWindows(port);
            } else {
                await killPortUnix(port);
            }
            resolve();
        } catch (e) {
            console.warn(`[PortKiller] Error freeing port ${port}:`, e.message);
            resolve(); // 不阻塞流程
        }
    });
}

/**
 * Unix/macOS/Linux 实现
 * @param {number} port 
 */
async function killPortUnix(port) {
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
    if (pids.length === 0) {
        console.log(`[PortKiller] Port ${port} is already free.`);
        return;
    }

    console.log(`[PortKiller] Killing processes on port ${port}: ${pids.join(', ')}`);

    // Kill -9
    const killCmd = `kill -9 ${pids.join(' ')}`;
    await new Promise(r => exec(killCmd, r));

    // Wait for release (max 5 seconds)
    let retries = 0;
    while (retries < 20) {
        await new Promise(r => setTimeout(r, 250));
        pids = await checkPort();
        if (pids.length === 0) {
            console.log(`[PortKiller] Port ${port} released successfully.`);
            return;
        }
        retries++;
    }

    console.warn(`[PortKiller] Failed to release port ${port} after 5s. PIDs remaining: ${pids.join(', ')}`);
}

/**
 * Windows 实现
 * @param {number} port 
 */
async function killPortWindows(port) {
    // 使用 netstat 查找占用端口的进程
    const findCmd = `netstat -ano | findstr :${port}`;

    const findPids = () => {
        return new Promise(r => {
            exec(findCmd, { shell: true }, (err, stdout) => {
                if (err || !stdout || !stdout.trim()) return r([]);
                
                // 解析 netstat 输出
                // 格式: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
                const lines = stdout.trim().split('\n');
                const pids = new Set();
                
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const lastPart = parts[parts.length - 1];
                    
                    // 检查是否是监听状态的连接
                    if (parts.includes('LISTENING') || parts.includes('ESTABLISHED')) {
                        const pid = parseInt(lastPart);
                        if (!isNaN(pid) && pid > 0) {
                            pids.add(pid);
                        }
                    }
                }
                
                r(Array.from(pids));
            });
        });
    };

    let pids = await findPids();
    if (pids.length === 0) {
        console.log(`[PortKiller] Port ${port} is already free.`);
        return;
    }

    console.log(`[PortKiller] Killing processes on port ${port}: ${pids.join(', ')}`);

    // 使用 taskkill 终止进程
    for (const pid of pids) {
        const killCmd = `taskkill /PID ${pid} /F`;
        await new Promise(r => exec(killCmd, { shell: true }, r));
    }

    // Wait for release (max 5 seconds)
    let retries = 0;
    while (retries < 20) {
        await new Promise(r => setTimeout(r, 250));
        pids = await findPids();
        if (pids.length === 0) {
            console.log(`[PortKiller] Port ${port} released successfully.`);
            return;
        }
        retries++;
    }

    console.warn(`[PortKiller] Failed to release port ${port} after 5s. PIDs remaining: ${pids.join(', ')}`);
}

/**
 * 检查端口是否被占用
 * @param {number} port 
 * @returns {Promise<boolean>}
 */
function isPortInUse(port) {
    return new Promise(resolve => {
        const cmd = isWindows 
            ? `netstat -ano | findstr :${port}`
            : `lsof -i:${port}`;

        exec(cmd, { shell: isWindows }, (err, stdout) => {
            if (err || !stdout || !stdout.trim()) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

module.exports = killPort;
module.exports.isPortInUse = isPortInUse;
module.exports.isWindows = isWindows;