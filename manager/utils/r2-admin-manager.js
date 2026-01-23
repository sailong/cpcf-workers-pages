const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class R2AdminManager {
    constructor(baseDir, resources, port = 9099) {
        this.baseDir = baseDir; // manager/system-workers/r2-admin
        this.resources = resources;
        this.process = null;
        this.port = parseInt(port) || 9099;
    }

    getBindingName(resourceId) {
        // Convert 'r2-123xyz' to 'B_r2_123xyz' to be a valid JS identifier
        return 'B_' + resourceId.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    updateConfig() {
        const tomlPath = path.join(this.baseDir, 'wrangler.toml');
        const buckets = this.resources.r2 || [];

        let content = `name = "r2-admin"
main = "src/index.js"
compatibility_date = "2024-01-01"

[observability]
enabled = true

`;

        buckets.forEach(b => {
            const binding = this.getBindingName(b.id);
            // bucket_name is the ID used for storage
            content += `[[r2_buckets]]\n`;
            content += `binding = "${binding}"\n`;
            content += `bucket_name = "${b.id}"\n\n`;
        });

        fs.writeFileSync(tomlPath, content);
    }

    async killProcessOnPort(port) {
        try {
            console.log(`[R2 Admin] Checking port ${port}...`);
            const portHex = parseInt(port).toString(16).toUpperCase().padStart(4, '0');

            let inodes = [];

            // Helper to parse tcp file
            const scanTcpFile = (filePath) => {
                try {
                    if (!fs.existsSync(filePath)) return;
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.split('\n');
                    for (let i = 1; i < lines.length; i++) {
                        const parts = lines[i].trim().split(/\s+/);
                        if (parts.length < 10) continue;
                        const localAddr = parts[1];
                        if (localAddr.endsWith(`:${portHex}`)) {
                            const inode = parts[9];
                            inodes.push(inode);
                            console.log(`[R2 Admin] Found socket inode ${inode} on port ${port} (${filePath})`);
                        }
                    }
                } catch (e) { console.log(`[R2 Admin] Error reading ${filePath}: ${e.message}`); }
            };

            scanTcpFile('/proc/net/tcp');
            scanTcpFile('/proc/net/tcp6');

            if (inodes.length === 0) return;

            // Find processes with these inodes open
            const pids = fs.readdirSync('/proc').filter(f => /^\d+$/.test(f));

            for (const pid of pids) {
                try {
                    const fdPath = `/proc/${pid}/fd`;
                    if (!fs.existsSync(fdPath)) continue;

                    const fds = fs.readdirSync(fdPath);
                    for (const fd of fds) {
                        try {
                            const link = fs.readlinkSync(path.join(fdPath, fd));
                            // link format: socket:[inode]
                            for (const inode of inodes) {
                                if (link === `socket:[${inode}]`) {
                                    console.log(`[R2 Admin] Killing process ${pid} (holding port ${port})`);
                                    process.kill(parseInt(pid), 'SIGKILL');
                                }
                            }
                        } catch (e) {
                            // ignore readlink error (file might disappear)
                        }
                    }
                } catch (e) {
                    // ignore permission errors or process disappearing
                }
            }

            // Wait a bit to ensure cleanup
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (e) {
            console.log(`[R2 Admin] Warning: Failed to clean up port ${port}: ${e.message}`);
        }
    }

    async start() {
        // Kill any previous instance managed by this object
        if (this.process) {
            console.log("[R2 Admin] Stopping previous instance...");
            try {
                if (this.process.pid && !this.process.killed) {
                    this.process.kill('SIGTERM');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) {
                console.log(`[R2 Admin] Warning: Error stopping previous instance: ${e.message}`);
            }
            this.process = null;
        }

        // --- NEW: Force cleanup of port 9100 regardless of who owns it ---
        await this.killProcessOnPort(this.port);

        this.updateConfig();
        console.log("[R2 Admin] Starting on port " + this.port);

        // Persist to .platform-data/r2-data (relative to manager/system-workers/r2-admin)
        const persistPath = path.join(this.baseDir, '../../../.platform-data/r2-data');

        // BIND TO 0.0.0.0 to fix Docker networking issues
        const args = ['wrangler', 'dev', '--ip', '0.0.0.0', '--port', this.port.toString(), '--persist-to', persistPath];

        this.process = spawn('npx', args, {
            cwd: this.baseDir,
            env: { ...process.env, PATH: process.env.PATH },
            shell: true,
            detached: false // Keep attached so it dies with manager? Or detached?
        });

        // Simple logging
        // this.process.stdout.on('data', d => console.log(`[R2 Admin] ${d.toString()}`));
        this.process.stderr.on('data', d => {
            // Filter noise
            const s = d.toString();
            if (!s.includes('GET /kv/') && !s.includes('No build')) console.log(`[R2 Admin] ${s.trim()}`);
        });
    }

    restart(newResources) {
        this.resources = newResources;
        this.start();
    }
}

module.exports = R2AdminManager;
