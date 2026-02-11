const fs = require('fs');
const net = require('net');
const config = require('../config');

let projects = [];

function load() {
    if (fs.existsSync(config.PROJECTS_FILE)) {
        try {
            projects = JSON.parse(fs.readFileSync(config.PROJECTS_FILE, 'utf8'));
        } catch (e) {
            console.error("Failed to load projects", e);
        }
    }
}

function save() {
    fs.writeFileSync(config.PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// === PORT MANAGEMENT ===

function isSystemPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true);
            } else {
                console.warn(`Port check error on ${port}: ${err.message}`);
                resolve(true);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port);
    });
}

async function isPortAvailable(port, excludeProjectId = null) {
    if (port < 1024 || port > 65535) {
        return { valid: false, error: "端口必须在 1024-65535 范围内" };
    }

    const existingProject = projects.find(p =>
        p.port === port && p.id !== excludeProjectId
    );

    if (existingProject) {
        return {
            valid: false,
            error: `端口 ${port} 已被项目 "${existingProject.name}" 占用`
        };
    }

    const inUse = await isSystemPortInUse(port);
    if (inUse) {
        return {
            valid: false,
            error: `端口 ${port} 已被系统进程或其他服务占用`
        };
    }

    return { valid: true };
}

async function getAvailablePort(preferredPort = null) {
    if (preferredPort) {
        const check = await isPortAvailable(preferredPort);
        if (check.valid) return preferredPort;
    }

    const startPort = parseInt(process.env.PORT_RANGE_START || 10000);
    const endPort = parseInt(process.env.PORT_RANGE_END || 20000);

    let port = startPort;
    while (port <= endPort) {
        const check = await isPortAvailable(port);
        if (check.valid) {
            return port;
        }
        port++;
    }

    throw new Error("没有可用端口");
}

load();

module.exports = {
    getAll: () => projects,
    getById: (id) => projects.find(p => p.id === id),
    add: (p) => { projects.push(p); save(); },
    remove: (id) => {
        const idx = projects.findIndex(p => p.id === id);
        if (idx !== -1) {
            projects.splice(idx, 1);
            save();
            return true;
        }
        return false;
    },
    save,
    isPortAvailable,
    getAvailablePort,
    isSystemPortInUse
};
