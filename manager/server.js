const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const net = require('net'); // Added for port check

const AUTH_FILE = path.join(__dirname, '../.platform-data/auth.json');
let runtimePassword = process.env.AUTH_PASSWORD || 'admin';
let JWT_SECRET = process.env.JWT_SECRET || null;

// Load persisted password and JWT_SECRET if exists
if (fs.existsSync(AUTH_FILE)) {
    try {
        const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
        if (authData.password) runtimePassword = authData.password;
        if (authData.jwtSecret) JWT_SECRET = authData.jwtSecret;
    } catch (e) { console.error("Failed to load auth file", e); }
}

// Generate and persist JWT_SECRET if not set
if (!JWT_SECRET) {
    JWT_SECRET = 'jwt-secret-' + Math.random().toString(36).substring(2) + Date.now();
    const authData = fs.existsSync(AUTH_FILE)
        ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
        : {};
    authData.jwtSecret = JWT_SECRET;
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
    console.log('Generated and persisted new JWT_SECRET');
}

const MANAGER_SERVICE_PORT = process.env.MANAGER_SERVICE_PORT || 3000;
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost'; // Support custom domains

const DATA_DIR = path.join(__dirname, '../.platform-data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const RESOURCES_FILE = path.join(DATA_DIR, 'resources.json');
const D1_DIR = path.join(DATA_DIR, 'd1-databases');

const app = express();

// ==========================================
// ==========================================
// Reverse Proxy Middleware
// Handles routing for <project-name>.<type>.<ROOT_DOMAIN>
// MUST be before express.static and body-parser
// ==========================================
const { createProxyMiddleware } = require('http-proxy-middleware');

// Fix: Define proxy middleware GLOBALLY once to prevent EventEmitter memory leaks.
// (Previously, creating it inside app.use() added new 'upgrade' listeners on every request)
const dynamicProxy = createProxyMiddleware({
    // default fallback, overridden by router
    target: `http://127.0.0.1:${MANAGER_SERVICE_PORT}`,
    router: (req) => {
        // Use the target we determined in the wrapper middleware
        return req.proxyTarget;
    },
    changeOrigin: true,
    ws: true,
    logLevel: 'error',
    onError: (err, req, res) => {
        const pName = req.proxyProjectName || 'Unknown';
        const pPort = req.proxyProjectPort || 'Unknown';
        if (!res.headersSent) {
            res.status(502).send(`Bad Gateway: Project '${pName}' not reachable (Port ${pPort}). Is it running?`);
        }
    }
});

app.use((req, res, next) => {
    const host = req.headers.host; // e.g., "my-worker.worker.localhost:8001" or "my-worker.worker.ccfwp.com"
    if (!host) return next();

    // Debug Log for Domain routing
    // console.log(`[ProxyDebug] Host: ${host}, ROOT_DOMAIN: ${ROOT_DOMAIN}`);

    // Remove port from host if present
    const hostname = host.split(':')[0];

    // Check if hostname ends with ROOT_DOMAIN
    // e.g. ROOT_DOMAIN="localhost" -> ends with ".localhost" (or is "localhost", but we need subdomain)
    // e.g. ROOT_DOMAIN="ccfwp.com" -> ends with ".ccfwp.com"

    // We expect at least one dot before ROOT_DOMAIN for subdomains
    const domainSuffix = '.' + ROOT_DOMAIN;

    if (hostname.endsWith(domainSuffix)) {
        // Extract the prefix (everything before .ROOT_DOMAIN)
        // e.g. "my-app-worker.ccfwp.com" -> "my-app-worker"
        const prefix = hostname.slice(0, -domainSuffix.length);

        console.log(`[ProxyRouter] Match! Prefix: ${prefix}, Suffix: ${domainSuffix}`);

        // New Logic: Use hyphen separator to flatten domain structure (SSL Wildcard Friendly)
        // Format: <first-part>-<last-part> where last-part is 'worker' or 'pages'
        // Regex: /^(.*)-(worker|pages)$/

        let projectName = prefix;
        let projectType = null;

        const match = prefix.match(/^(.*)-(worker|pages)$/);

        if (match) {
            projectName = match[1]; // "my-app"
            projectType = match[2]; // "worker"
            console.log(`[ProxyRouter] Resolved Project: ${projectName}, Type: ${projectType}`);
        } else {
            console.log(`[ProxyRouter] No type match for prefix: ${prefix}, treating as project name`);
        }

        // If no match, it falls back to treating 'prefix' as projectName (Legacy/Direct access)

        // Find project
        // Note: 'projects' variable is identified at module scope below, safely accessible at runtime
        // projectName is already set to prefix.

        // Find project
        // Note: 'projects' variable is identified at module scope below, safely accessible at runtime
        const project = projects.find(p => {
            const nameMatch = p.name.toLowerCase() === projectName.toLowerCase();
            // Robust type check (case-insensitive)
            // Also handle case where project uses old type-less structure in DB? (Unlikely)
            const typeMatch = projectType ? (p.type && p.type.toLowerCase() === projectType.toLowerCase()) : true;
            return nameMatch && typeMatch;
        });

        if (!project) {
            console.log(`[ProxyRouter] Lookup failed for Name: ${projectName}, Type: ${projectType}`);
        } else {
            console.log(`[ProxyRouter] Found Project: ${project.name} (Port: ${project.port})`);
        }

        if (project && project.port) {
            // Attach target info to request for the global proxy router
            req.proxyTarget = `http://127.0.0.1:${project.port}`;
            req.proxyProjectName = project.name;
            req.proxyProjectPort = project.port;

            // Delegate to the global proxy instance
            return dynamicProxy(req, res, next);
        }

        if (parts[0] !== '127') {
            // 404 if project not found
            return res.status(404).send(`Project '${projectName}' ${projectType ? `(type: ${projectType})` : ''} not found.`);
        }
    }

    next();
});

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, 'client/dist')));

// Ensure dirs exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(D1_DIR)) fs.mkdirSync(D1_DIR, { recursive: true });

app.use(cors());
app.use(bodyParser.json());

// Init Projects DB
let projects = [];
if (fs.existsSync(PROJECTS_FILE)) {
    try {
        projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    } catch (e) {
        console.error("Failed to load projects", e);
    }
}



// ==========================================
// Reverse Proxy Middleware
// Handles routing for <project-name>.localhost:8001
// ==========================================




function saveProjects() {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// Init Resources DB
let resources = { kv: [], d1: [], r2: [] };
if (fs.existsSync(RESOURCES_FILE)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(RESOURCES_FILE, 'utf8'));
        resources = { ...resources, ...loaded };
        // Ensure new resource types exist if loading from old file
        if (!resources.r2) resources.r2 = [];
        if (!resources.kv) resources.kv = [];
        if (!resources.d1) resources.d1 = [];
    } catch (e) {
        console.error("Failed to load resources", e);
    }
}

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
});

// Captcha
app.get('/api/captcha', (req, res) => {
    const captcha = svgCaptcha.create({
        size: 4,
        ignoreChars: '0o1i',
        noise: 2,
        color: true,
        background: '#111827' // gray-900 to match dark theme
    });

    // Sign the captcha text into a token (avoid session state)
    const captchaToken = jwt.sign(
        { text: captcha.text.toLowerCase() },
        JWT_SECRET,
        { expiresIn: '5m' }
    );

    res.json({
        image: captcha.data,
        captchaId: captchaToken
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password, captcha, captchaId } = req.body;

    // 1. Verify Captcha
    if (!captcha || !captchaId) {
        return res.status(400).json({ error: "请输入验证码" });
    }

    try {
        const decoded = jwt.verify(captchaId, JWT_SECRET);
        if (decoded.text !== captcha.toLowerCase()) {
            return res.status(400).json({ error: "验证码错误" });
        }
    } catch (e) {
        return res.status(400).json({ error: "验证码失效，请刷新" });
    }

    // 2. Verify Credentials
    if (username !== 'admin') {
        return res.status(401).json({ error: "用户名或密码错误" });
    }

    if (password === runtimePassword) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ success: true, token });
    }
    res.status(401).json({ error: "用户名或密码错误" });
});

// Change Password
app.post('/api/change-password', (req, res) => {
    // Auth middleware usually covers this if route starts with /api/
    // But we need to check if user is logged in
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.sendStatus(401);

    const { oldPassword, newPassword } = req.body;

    if (oldPassword !== runtimePassword) {
        return res.status(400).json({ error: "旧密码错误" });
    }

    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: "新密码长度至少4位" });
    }

    runtimePassword = newPassword;

    // Persist (keep existing jwtSecret)
    const authData = fs.existsSync(AUTH_FILE)
        ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
        : {};
    authData.password = newPassword;
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));

    res.json({ success: true });
});

// Auth Middleware
app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (req.path === '/api/login' || req.path === '/api/health' || req.path === '/api/captcha') return next();

    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
});

function saveResources() {
    fs.writeFileSync(RESOURCES_FILE, JSON.stringify(resources, null, 2));
}

// Upload Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
})
const upload = multer({ storage: storage })

// --- API ROUTES ---

const ProjectRuntime = require('./utils/spawner');
const R2AdminManager = require('./utils/r2-admin-manager');

// Init Runtime
// Init Runtime
const runtime = new ProjectRuntime(UPLOADS_DIR, resources);
const R2_PORT = process.env.R2_ADMIN_PORT || 9099;
const r2Admin = new R2AdminManager(path.join(__dirname, 'system-workers/r2-admin'), resources, R2_PORT);

// Update runtime resources reference when they change
function updateRuntimeResources() {
    runtime.resources = resources;
}

// Restart running projects on boot
// Restart running projects and System Worker on boot
(async () => {
    for (const p of projects) {
        if (p.status === 'running') {
            console.log(`[Auto-Start] Restoring project ${p.name}...`);

            // Fix legacy projects without port
            if (!p.port) {
                try {
                    console.log(`[Auto-Start] Project ${p.name} has no port, assigning internal port...`);
                    p.port = await getAvailablePort();
                    saveProjects();
                } catch (e) {
                    console.error(`[Auto-Start] Failed to assign port for ${p.name}: ${e.message}`);
                    p.status = 'stopped';
                    saveProjects();
                    continue;
                }
            }

            try {
                // Ensure port is not occupied by system
                const portCheck = await isSystemPortInUse(p.port);
                if (portCheck) {
                    console.warn(`[Auto-Start] Port ${p.port} for ${p.name} is in use. Assigning new port...`);
                    p.port = await getAvailablePort();
                    saveProjects();
                }

                await runtime.start(p);
            } catch (e) {
                console.error(`[Auto-Start] Failed to start ${p.name}:`, e);
                p.status = 'stopped'; // Mark as stopped if failed
                saveProjects();
            }
        }
    }
    r2Admin.start();
})();

// --- API ROUTES ---

// 1. Get All Projects (with Real-time Status)
app.get('/api/projects', (req, res) => {
    // Merge runtime status
    const projectsWithStatus = projects.map(p => ({
        ...p,
        status: runtime.isRunning(p.id) ? 'running' : 'stopped'
    }));
    res.json(projectsWithStatus);
});

// === PORT MANAGEMENT HELPERS ===

/**
 * 检查系统端口是否被占用 (尝试绑定)
 * @param {number} port 
 * @returns {Promise<boolean>} true if in use, false if free
 */
function isSystemPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true); // Port is in use
            } else {
                resolve(false); // Other error, assume free? Or strict fail? 
                // For safety, if we can't bind, we assume it's not safe to use.
                // But let's log it.
                console.warn(`Port check error on ${port}: ${err.message}`);
                resolve(true);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(false); // Port is free
        });
        server.listen(port);
    });
}

/**
 * 验证端口是否可用 (包含数据库检查和系统检查)
 * @param {number} port - 要验证的端口
 * @param {string} excludeProjectId - 排除的项目 ID（用于更新场景）
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function isPortAvailable(port, excludeProjectId = null) {
    // 检查端口范围
    if (port < 1024 || port > 65535) {
        return { valid: false, error: "端口必须在 1024-65535 范围内" };
    }

    // 1. 检查是否被其他项目占用 (DB Check)
    const existingProject = projects.find(p =>
        p.port === port && p.id !== excludeProjectId
    );

    if (existingProject) {
        return {
            valid: false,
            error: `端口 ${port} 已被项目 "${existingProject.name}" 占用`
        };
    }

    // 2. 检查系统端口是否实际被占用 (System Check)
    const inUse = await isSystemPortInUse(port);
    if (inUse) {
        return {
            valid: false,
            error: `端口 ${port} 已被系统进程或其他服务占用`
        };
    }

    return { valid: true };
}

/**
 * 获取可用端口
 * @param {number} preferredPort - 首选端口
 * @returns {Promise<number>} 可用端口
 */
async function getAvailablePort(preferredPort = null) {
    // 如果指定了首选端口且可用，使用它
    if (preferredPort) {
        const check = await isPortAvailable(preferredPort);
        if (check.valid) return preferredPort;
    }

    // 否则从起始范围开始寻找
    // 默认使用 10000+ 的内部端口，避免与常用开发端口冲突
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

    // 如果范围内没有可用端口，抛出错误
    throw new Error("没有可用端口");
}

// === PROJECT MANAGEMENT API ===

// 2. Create Project
app.post('/api/projects', async (req, res) => {
    console.log('[DEBUG] Create Project Request Body:', JSON.stringify(req.body, null, 2));
    const { name, type, mainFile, bindings, envVars, port: customPort, code, filename } = req.body;
    console.log(`[DEBUG] Parsed: name=${name}, type=${type}, mainFile=${mainFile}, codeLen=${code ? code.length : 0}, filename=${filename}`);

    // Validate Name: 
    // 1. Only English letters, numbers, and hyphens
    // 2. Cannot start or end with a hyphen
    // Regex: Start with alphanumeric, optionally followed by (alphanumeric/hyphen)* ending with alphanumeric
    const nameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    if (!nameRegex.test(name)) {
        return res.status(400).json({ error: "项目名称非法：只能包含字母/数字/连字符，且不能以连字符开头或结尾" });
    }

    // 检查项目名称重复 (Same Name & Same Type)
    // 允许同名但不同类型? 通常最好也不要，避免混淆 DNS。
    // 但用户说 "同一类型（worker或pages）的项目...要验证名称不能重复"
    // 我们这里严谨一点，如果只是 type 不同可能 DNS 也会冲突 (因为都用 name.type.localhost)
    // 修正: 我们的路由是 <name>.<type>.localhost. 
    // 防止混淆，且避免用户误解，我们先按用户要求 "同一类型不能重复"。
    // 实际: 端口分配独立，Host路由独立，理论上不同类型同名可以存活。
    // 但是 id 生成逻辑是 name + timestamp，如果 name 一样 type 一样肯定不行。

    const existing = projects.find(p => p.name === name && p.type === type);
    if (existing) {
        return res.status(400).json({ error: `该类型的项目名称 "${name}" 已存在，请更换名称` });
    }

    // Simple ID gen
    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4);

    // 端口处理：验证自定义端口或自动分配
    let port;
    try {
        if (customPort) {
            // 用户指定了端口，验证是否可用
            const portNum = parseInt(customPort);
            const portCheck = await isPortAvailable(portNum);
            if (!portCheck.valid) {
                return res.status(400).json({ error: portCheck.error });
            }
            port = portNum;
        } else {
            // 自动分配可用端口
            port = await getAvailablePort();
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }


    // 处理代码输入：如果提供了代码，创建文件
    let actualMainFile = mainFile;
    if (code && filename) {
        // 直接从代码创建文件
        const generatedFilename = `${id}-${filename}`;
        const filePath = path.join(UPLOADS_DIR, generatedFilename);
        console.log(`[DEBUG] Writing file to: ${filePath}`);
        fs.writeFileSync(filePath, code, 'utf8');
        actualMainFile = generatedFilename;
        console.log(`Created file from code: ${generatedFilename}`);
    } else if (!mainFile) {
        return res.status(400).json({ error: "必须提供 mainFile 或 code+filename" });
    }

    const newProject = {
        id,
        name,
        type,
        port,
        status: 'stopped',
        mainFile: actualMainFile,
        bindings: bindings || {},
        envVars: envVars || {},
        createdAt: new Date().toISOString()
    };

    projects.push(newProject);
    saveProjects();
    res.json(newProject);
});

// 3. Upload File (Enhanced for Pages ZIP support)
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = path.join(UPLOADS_DIR, req.file.filename);
    const isZip = req.file.originalname.toLowerCase().endsWith('.zip');

    if (isZip) {
        // Extract ZIP for Pages projects
        const AdmZip = require('adm-zip');
        const extractDir = path.join(UPLOADS_DIR, 'page-' + Date.now().toString(36));

        try {
            const zip = new AdmZip(filePath);
            zip.extractAllTo(extractDir, true);

            // Delete the ZIP file after extraction
            fs.unlinkSync(filePath);

            // Return the directory name (relative to UPLOADS_DIR)
            res.json({
                filename: path.basename(extractDir),
                originalName: req.file.originalname,
                isDirectory: true
            });
        } catch (e) {
            return res.status(500).json({ error: "Failed to extract ZIP: " + e.message });
        }
    } else {
        // Single file upload (for Workers)
        res.json({ filename: req.file.filename, originalName: req.file.originalname, isDirectory: false });
    }
});

// 4. Start Project
app.post('/api/projects/:id/start', async (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { force } = req.body; // Check for force flag

    try {
        // 1. Check if port is in use
        const inUse = await isSystemPortInUse(project.port);
        if (inUse) {
            if (force) {
                console.log(`[Force Start] Killing process on port ${project.port}...`);

                // Try to kill friendly projects first
                const conflictingProject = projects.find(p => p.port === project.port && p.status === 'running' && p.id !== project.id);
                if (conflictingProject) {
                    console.log(`[Force Start] Stopping conflicting project ${conflictingProject.name}...`);
                    runtime.stop(conflictingProject.id);
                    conflictingProject.status = 'stopped';
                    saveProjects();
                } else {
                    // Kill system process using fuser (requires psmisc installed in Dockerfile)
                    try {
                        require('child_process').execSync(`fuser -k ${project.port}/tcp`);
                        console.log(`[Force Start] System process on port ${project.port} killed.`);
                        // Wait a moment for release
                        await new Promise(r => setTimeout(r, 1000));
                    } catch (e) {
                        console.error(`[Force Start] Failed to kill process on port ${project.port}:`, e.message);
                        // If fuser fails (e.g. permission or not found), we might still try? 
                        // Or just throw error.
                        // If return code is 1, it means no process found, but we deduced inUse=true?
                        // Race condition? Let's proceed and see if start fails.
                    }
                }
            } else {
                // Return 409 Conflict with details
                // Try to identify what is using it
                const conflictingProject = projects.find(p => p.port === project.port && p.status === 'running' && p.id !== project.id);
                const ownerName = conflictingProject ? `项目 "${conflictingProject.name}"` : "未知系统进程";

                return res.status(409).json({
                    error: `端口 ${project.port} 已被占用 (${ownerName})`,
                    portInUse: true,
                    owner: ownerName
                });
            }
        }

        await runtime.start(project);
        project.status = 'running';
        saveProjects();
        res.json({ message: "Project started", project });
    } catch (e) {
        console.error("Start failed", e);
        res.status(500).json({ error: "Start failed: " + e.message });
    }
});

// 5. Stop Project
app.post('/api/projects/:id/stop', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    runtime.stop(project.id);
    project.status = 'stopped';
    saveProjects();

    res.json({ message: "Project stopped", project });
});

// 6. Delete Project
app.delete('/api/projects/:id', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Stop if running
    if (project.status === 'running') {
        runtime.stop(project.id);
    }

    // Remove from list
    projects = projects.filter(p => p.id !== req.params.id);
    saveProjects();


    res.json({ message: "Project deleted", id: req.params.id });
});

// 7. Get Project Code
app.get('/api/projects/:id/code', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const filePath = path.join(UPLOADS_DIR, project.mainFile);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Code file not found" });
    }

    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const language = project.mainFile.endsWith('.ts') ? 'typescript' : 'javascript';

        res.json({
            code,
            filename: project.mainFile,
            language
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to read code file" });
    }
});

// 8. Update Project Code
app.put('/api/projects/:id/code', (req, res) => {
    const { code } = req.body;
    const project = projects.find(p => p.id === req.params.id);

    if (!project) return res.status(404).json({ error: "Project not found" });
    if (code === undefined || code === null) {
        return res.status(400).json({ error: "Code is required" });
    }

    const filePath = path.join(UPLOADS_DIR, project.mainFile);

    try {
        // 备份原文件
        const backupPath = filePath + '.backup';
        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, backupPath);
        }

        // 写入新代码
        fs.writeFileSync(filePath, code, 'utf8');

        // 如果项目正在运行，重启
        const wasRunning = project.status === 'running';
        if (wasRunning) {
            runtime.stop(project.id);
            // 等待一会儿再重启
            setTimeout(() => {
                runtime.start(project);
                project.status = 'running';
                saveProjects();
            }, 1000);
        }

        res.json({
            success: true,
            message: "Code updated successfully",
            restarted: wasRunning
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9. Upload File to Replace Code
// 9. Upload File to Replace Code/Site
app.post('/api/projects/:id/upload-replace', upload.single('file'), (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Handle Pages Project (Folder Replacement)
    if (project.type === 'pages') {
        const isZip = req.file.originalname.toLowerCase().endsWith('.zip');
        if (!isZip) return res.status(400).json({ error: "Pages updates require a ZIP file" });

        const targetDir = path.join(UPLOADS_DIR, project.mainFile); // mainFile is the directory name
        const zipPath = req.file.path;

        try {
            const AdmZip = require('adm-zip');

            // 1. Clean old directory
            if (fs.existsSync(targetDir)) {
                fs.rmSync(targetDir, { recursive: true, force: true });
            }
            fs.mkdirSync(targetDir, { recursive: true });

            // 2. Extract new ZIP
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(targetDir, true);

            // 3. Cleanup ZIP
            fs.unlinkSync(zipPath);

            // 4. Restart if running
            const wasRunning = project.status === 'running';
            if (wasRunning) {
                runtime.stop(project.id);
                setTimeout(() => {
                    runtime.start(project);
                    project.status = 'running';
                    saveProjects();
                }, 1000);
            }

            res.json({
                success: true,
                message: "Site updated successfully",
                restarted: wasRunning
            });

        } catch (e) {
            res.status(500).json({ error: "Failed to update pages site: " + e.message });
        }
        return;
    }

    // Handle Workers Project (File Replacement)
    const oldFilePath = path.join(UPLOADS_DIR, project.mainFile);
    const newFilePath = req.file.path;

    try {
        // 备份并删除旧文件
        const backupPath = oldFilePath + '.backup';
        if (fs.existsSync(oldFilePath)) {
            fs.copyFileSync(oldFilePath, backupPath);
            fs.unlinkSync(oldFilePath);
        }

        // 更新项目配置
        project.mainFile = req.file.filename;
        saveProjects();

        // 如果正在运行，重启
        const wasRunning = project.status === 'running';
        if (wasRunning) {
            runtime.stop(project.id);
            setTimeout(() => {
                runtime.start(project);
                project.status = 'running';
                saveProjects();
            }, 1000);
        }

        res.json({
            success: true,
            filename: req.file.filename,
            message: "File replaced successfully",
            restarted: wasRunning
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// === PROJECT CONFIGURATION API ===

const { maskSecrets } = require('./utils/crypto-helper');

// 10. Get Full Project Configuration
app.get('/api/projects/:id/full-config', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const filePath = path.join(UPLOADS_DIR, project.mainFile);
    let code = '';

    if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            code = fs.readFileSync(filePath, 'utf8');
        } else {
            code = ''; // It's a directory (Pages project)
        }
    }

    res.json({
        code,
        filename: project.mainFile,
        language: project.mainFile.endsWith('.ts') ? 'typescript' : 'javascript',
        bindings: {
            kv: [],
            d1: [],
            r2: [],
            ...(project.bindings || {})
        },
        envVars: maskSecrets(project.envVars || {}),
        envVarsRaw: project.envVars || {},
        port: project.port,
        name: project.name,
        type: project.type
    });
});



// 11. Update Project Configuration (bindings and envVars)
app.put('/api/projects/:id/config', async (req, res) => {
    const { bindings, envVars, port } = req.body;
    const project = projects.find(p => p.id === req.params.id);

    if (!project) return res.status(404).json({ error: "Project not found" });

    // 更新端口
    if (port !== undefined && port !== project.port) {
        const portNum = parseInt(port);
        // 如果是新端口，检查可用性
        const check = await isPortAvailable(portNum);
        // 注意：如果是当前项目占用的端口，isPortAvailable 可能会返回 false (被占用)，所以要特判吗？
        // isPortAvailable 只是检查端口是否被监听。如果当前项目正在运行，该端口当然被占用。
        // 所以，如果项目正在运行且端口没变，不需要检查。
        // 如果端口变了，新端口必须是空闲的。

        if (!check.valid) {
            return res.status(400).json({ error: `端口 ${portNum} 不可用: ${check.error}` });
        }
        project.port = portNum;
    }

    // 更新配置
    if (bindings !== undefined) {
        project.bindings = bindings;
    }

    if (envVars !== undefined) {
        project.envVars = envVars;
    }

    saveProjects();

    // 如果正在运行，重启
    const wasRunning = project.status === 'running';
    if (wasRunning) {
        runtime.stop(project.id);
        setTimeout(() => {
            runtime.start(project);
            project.status = 'running';
            saveProjects();
        }, 1000);
    }

    res.json({
        success: true,
        message: "Configuration updated successfully",
        restarted: wasRunning
    });
});


// === FILE MANAGEMENT API (For Pages) ===

// glob removed


// 12. List Project Files
app.get('/api/projects/:id/files/list', async (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    // For Pages, mainFile is the directory. For Workers, it's a file (so list is just that file).
    // Let's assume this is mostly for Pages.
    const projectDir = path.join(UPLOADS_DIR, project.mainFile);

    if (!fs.existsSync(projectDir)) {
        return res.status(404).json({ error: "Project directory not found" });
    }

    if (!fs.statSync(projectDir).isDirectory()) {
        // It's a file (Worker), just return the file itself
        return res.json([project.mainFile]);
    }

    try {
        // Find all files recursively
        // We use 'glob' if available, otherwise manual recursion? 
        // Let's implement a simple recursive walker since glob might not be installed in server package.json.
        // Or check if I can use 'glob'. glob is common but not guaranteed.
        // I'll write a simple recursive function to avoid dependency issues if glob isn't there.

        const getFiles = (dir, baseDir) => {
            let results = [];
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                const relativePath = path.relative(baseDir, filePath);

                if (stat && stat.isDirectory()) {
                    results = results.concat(getFiles(filePath, baseDir));
                } else {
                    results.push(relativePath);
                }
            });
            return results;
        };

        const files = getFiles(projectDir, projectDir);
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: "Failed to list files: " + e.message });
    }
});

// 13. Read File Content
app.get('/api/projects/:id/files/content', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const filePathParam = req.query.path;
    if (!filePathParam) return res.status(400).json({ error: "Path required" });

    const projectDir = path.join(UPLOADS_DIR, project.mainFile);
    // Security check: ensure target path is inside projectDir
    const targetPath = path.resolve(projectDir, filePathParam);

    // For Workers (single file), mainFile is the file. path.resolve treats it as dir base?
    // If project.mainFile is 'worker.js', projectDir is '.../worker.js'.
    // If we join 'worker.js' with 'foo', it resolves to '.../foo'. This is wrong.
    // But this API is mainly for Pages (directories).
    // If it is a Worker, we should probably handle differently or just restrict this API to Pages or Directory-based projects.
    // Let's allow flexibility but check traversal.

    if (!targetPath.startsWith(projectDir)) {
        return res.status(403).json({ error: "Access denied: Path traversal detected" });
    }

    if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ error: "File not found" });
    }

    if (fs.statSync(targetPath).isDirectory()) {
        return res.status(400).json({ error: "Cannot read directory content" });
    }

    try {
        const content = fs.readFileSync(targetPath, 'utf8');
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: "Failed to read file" });
    }
});

// 14. Write File Content
app.put('/api/projects/:id/files/content', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { path: filePathParam, content } = req.body;
    if (!filePathParam || content === undefined) return res.status(400).json({ error: "Path and content required" });

    const projectDir = path.join(UPLOADS_DIR, project.mainFile);
    const targetPath = path.resolve(projectDir, filePathParam);

    if (!targetPath.startsWith(projectDir)) {
        return res.status(403).json({ error: "Access denied" });
    }

    try {
        // Ensure parent dir exists (if creating new file)
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf8');

        // For Pages, wrangler dev should auto-reload.
        // For Workers, we might need to restart if it's the main file.
        // But for Pages usually it's static assets or functions.
        // We won't force restart here to allow quick edits.

        res.json({ success: true, message: "File saved" });
    } catch (e) {
        res.status(500).json({ error: "Failed to save file: " + e.message });
    }
});



// === RESOURCE MANAGEMENT API ===

// KV Namespace APIs
app.get('/api/resources/kv', (req, res) => {
    res.json(resources.kv);
});

app.post('/api/resources/kv', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    // Check duplicate
    if (resources.kv.find(kv => kv.name === name)) {
        return res.status(400).json({ error: "KV Namespace already exists" });
    }

    const newKV = {
        id: 'kv-' + Date.now().toString(36),
        name,
        createdAt: new Date().toISOString()
    };

    resources.kv.push(newKV);
    saveResources();
    res.json(newKV);
});

// KV Key-Value Operations
const kvStorage = require('./utils/kv-storage');

// List keys in KV namespace
app.get('/api/resources/kv/:id/keys', (req, res) => {
    const { id } = req.params;
    const { prefix = '', limit = 1000 } = req.query;

    const kv = resources.kv.find(k => k.id === id);
    if (!kv) return res.status(404).json({ error: "KV Namespace not found" });

    try {
        const keys = kvStorage.listKeys(id, prefix, parseInt(limit));
        res.json({ keys, list_complete: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get value for a key
app.get('/api/resources/kv/:id/values/:key', (req, res) => {
    const { id, key } = req.params;

    const kv = resources.kv.find(k => k.id === id);
    if (!kv) return res.status(404).json({ error: "KV Namespace not found" });

    try {
        const value = kvStorage.getValue(id, key);
        if (value === undefined) {
            return res.status(404).json({ error: "Key not found" });
        }
        res.json({ value });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set/update key-value pair
app.put('/api/resources/kv/:id/values/:key', (req, res) => {
    const { id, key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
        return res.status(400).json({ error: "Value is required" });
    }

    const kv = resources.kv.find(k => k.id === id);
    if (!kv) return res.status(404).json({ error: "KV Namespace not found" });

    try {
        kvStorage.setValue(id, key, value);
        res.json({ success: true, key, value });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a key
app.delete('/api/resources/kv/:id/values/:key', (req, res) => {
    const { id, key } = req.params;

    const kv = resources.kv.find(k => k.id === id);
    if (!kv) return res.status(404).json({ error: "KV Namespace not found" });

    try {
        kvStorage.deleteKey(id, key);
        res.json({ success: true, message: "Key deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete KV Namespace
app.delete('/api/resources/kv/:id', (req, res) => {
    const { id } = req.params;

    const kv = resources.kv.find(k => k.id === id);
    if (!kv) return res.status(404).json({ error: "KV Namespace not found" });

    try {
        // Delete data file
        kvStorage.deleteNamespace(id);

        // Remove from list
        resources.kv = resources.kv.filter(k => k.id !== id);
        saveResources();

        res.json({ success: true, message: "KV Namespace deleted", id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// D1 Database APIs
app.get('/api/resources/d1', (req, res) => {
    res.json(resources.d1);
});

// ... (D1 POST/DELETE is below this in original, but I will append R2 APIs after D1 APIs)

// R2 Bucket APIs
app.get('/api/resources/r2', (req, res) => {
    res.json(resources.r2);
});

app.post('/api/resources/r2', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    // Check duplicate
    if (resources.r2.find(b => b.name === name)) {
        return res.status(400).json({ error: "R2 Bucket already exists" });
    }

    const newBucket = {
        id: 'r2-' + Date.now().toString(36),
        name,
        createdAt: new Date().toISOString()
    };

    resources.r2.push(newBucket);
    saveResources();
    r2Admin.restart(resources);
    res.json(newBucket);
});

app.delete('/api/resources/r2/:id', (req, res) => {
    const { id } = req.params;
    const bucket = resources.r2.find(b => b.id === id);
    if (!bucket) return res.status(404).json({ error: "R2 Bucket not found" });

    resources.r2 = resources.r2.filter(b => b.id !== id);
    saveResources();
    r2Admin.restart(resources);
    res.json({ success: true, message: "R2 Bucket deleted", id });
});

// === R2 FILE MANAGEMENT API (Proxied to System Worker) ===
const R2_ADMIN_URL = `http://127.0.0.1:${R2_PORT}`;

// Helper for fetch (Node 18+)
const fetch = global.fetch;

// List Files
app.get('/api/resources/r2/:id/files', async (req, res) => {
    const { id } = req.params;
    const { cursor, limit, prefix, delimiter } = req.query;

    // Construct URL
    const url = new URL(`${R2_ADMIN_URL}/list`);
    url.searchParams.set('bucket', id);
    if (cursor) url.searchParams.set('cursor', cursor);
    if (limit) url.searchParams.set('limit', limit);
    if (prefix) url.searchParams.set('prefix', prefix);
    if (delimiter) url.searchParams.set('delimiter', delimiter);

    try {
        const upstream = await fetch(url.toString());
        if (!upstream.ok) {
            const txt = await upstream.text();
            return res.status(upstream.status).json({ error: txt });
        }
        const data = await upstream.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: "Failed to connect to R2 Admin: " + e.message });
    }
});

// Upload File
app.post('/api/resources/r2/:id/files', upload.single('file'), async (req, res) => {
    const { id } = req.params;
    let key = req.body.key || (req.file ? req.file.originalname : null);

    if (!req.file || !key) return res.status(400).json({ error: "File and Key required" });

    // Debug encoding
    console.log(`[Upload] Original Name: ${req.file.originalname}`);
    console.log(`[Upload] Key (before fix): ${key}`);

    // Try to fix encoding if it looks garbled (common issue with multer/busboy defaults)
    // If the key contains "å" and other latin1 chars, it might be utf8 interpreted as latin1.
    // However, we can blindly try to decode if we suspect it.
    // But better to just fix it:
    // req.file.originalname is often Latin-1 encoded UTF-8 bytes.
    try {
        const fixed = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        console.log(`[Upload] Fixed Name candidate: ${fixed}`);
        // Simple heuristic: if the fixed string looks valid and the original had "weird" chars
        // For now, let's just use the fixed one if it differs?
        // Actually, for Chinese users, this is almost ALWAYS the case with default multer.
        key = fixed;
    } catch (e) {
        console.log("Encoding fix failed", e);
    }

    console.log(`[Upload] Final Key: ${key}`);

    try {
        const fileContent = fs.readFileSync(req.file.path);

        const url = new URL(`${R2_ADMIN_URL}/put`);
        url.searchParams.set('bucket', id);
        url.searchParams.set('key', key);

        const upstream = await fetch(url.toString(), {
            method: 'PUT',
            body: fileContent
        });

        // Cleanup temp upload
        fs.unlinkSync(req.file.path);

        if (!upstream.ok) {
            const txt = await upstream.text();
            return res.status(upstream.status).json({ error: txt });
        }

        res.json({ success: true, key });
    } catch (e) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "Upload failed: " + e.message });
    }
});

// Delete File
app.delete('/api/resources/r2/:id/files/:key', async (req, res) => {
    const { id, key } = req.params;
    // Decode key because it might be double encoded if in URL path?
    // Usually express decodes params. But if key contains slashes, it might be tricky.
    // Client should encodeURIComponent. Express decodes it.
    // However, if key has '/', express logic might split it.
    // Better to pass key as query param for safety in DELETE? 
    // Or use catch-all logic. 
    // Let's assume simple keys for now, or allow client to pass encoded key.

    const url = new URL(`${R2_ADMIN_URL}/delete`);
    url.searchParams.set('bucket', id);
    url.searchParams.set('key', key);

    try {
        const upstream = await fetch(url.toString(), { method: 'DELETE' });
        if (!upstream.ok) {
            const txt = await upstream.text();
            return res.status(upstream.status).json({ error: txt });
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Delete failed: " + e.message });
    }
});

// Download/Get File
app.get('/api/resources/r2/:id/files/:key(*)', async (req, res) => {
    const { id } = req.params;
    const key = req.params[0]; // Capture wildcard for key with slashes

    const url = new URL(`${R2_ADMIN_URL}/get`);
    url.searchParams.set('bucket', id);
    url.searchParams.set('key', key);

    try {
        const upstream = await fetch(url.toString());
        if (!upstream.ok) {
            if (upstream.status === 404) return res.status(404).send("File not found");
            const txt = await upstream.text();
            return res.status(upstream.status).send(txt);
        }

        // Stream back
        // fetch response.body is a ReadableStream (web standard) in Node 18
        // Express res is a WritableStream (Node stream)
        // Need to convert Web Stream to Node Stream
        const { Readable } = require('stream');
        // @ts-ignore
        const nodeStream = Readable.fromWeb(upstream.body);

        // Set headers
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
        if (upstream.headers.has('etag')) res.setHeader('ETag', upstream.headers.get('etag'));

        nodeStream.pipe(res);
    } catch (e) {
        res.status(500).send("Download failed: " + e.message);
    }
});

app.post('/api/resources/d1', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    // Check duplicate
    if (resources.d1.find(db => db.name === name)) {
        return res.status(400).json({ error: "D1 Database already exists" });
    }

    const newD1 = {
        id: 'd1-' + Date.now().toString(36),
        name,
        createdAt: new Date().toISOString()
    };

    resources.d1.push(newD1);
    saveResources();
    res.json(newD1);
});

// Delete D1 Database
app.delete('/api/resources/d1/:id', (req, res) => {
    const { id } = req.params;

    const db = resources.d1.find(d => d.id === id);
    if (!db) return res.status(404).json({ error: "D1 Database not found" });

    try {
        // Delete database file
        const dbPath = path.join(D1_DIR, `${id}.db`);
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }

        // Remove from list
        resources.d1 = resources.d1.filter(d => d.id !== id);
        saveResources();

        res.json({ success: true, message: "D1 Database deleted", id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// === D1 DATABASE MANAGEMENT API (using better-sqlite3) ===
const d1Helper = require('./utils/d1-helper');

// Execute SQL on a D1 database
app.post('/api/resources/d1/:id/execute', (req, res) => {
    const { id } = req.params;
    const { sql } = req.body;

    if (!sql) return res.status(400).json({ error: "SQL is required" });

    const dbMeta = resources.d1.find(d => d.id === id);
    if (!dbMeta) return res.status(404).json({ error: "D1 Database not found" });

    try {
        const result = d1Helper.executeSQL(id, sql);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List tables in D1 database
app.get('/api/resources/d1/:id/tables', (req, res) => {
    const { id } = req.params;
    const dbMeta = resources.d1.find(d => d.id === id);
    if (!dbMeta) return res.status(404).json({ error: "D1 Database not found" });

    try {
        const tables = d1Helper.listTables(id);
        res.json(tables);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Query data from a specific table
app.get('/api/resources/d1/:id/query', (req, res) => {
    const { id } = req.params;
    const { table, limit = 100 } = req.query;

    if (!table) return res.status(400).json({ error: "Table name is required" });

    const dbMeta = resources.d1.find(d => d.id === id);
    if (!dbMeta) return res.status(404).json({ error: "D1 Database not found" });

    try {
        const data = d1Helper.queryTable(id, table, parseInt(limit));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get table structure
app.get('/api/resources/d1/:id/schema/:table', (req, res) => {
    const { id, table } = req.params;
    const dbMeta = resources.d1.find(d => d.id === id);
    if (!dbMeta) return res.status(404).json({ error: "D1 Database not found" });

    try {
        const structure = d1Helper.getTableStructure(id, table);
        res.json(structure);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve UI
app.get('/', (req, res) => {
    res.send("Cloudflare Platform Manager API is running. <br> Frontend failed to load? Check /app/manager/client/dist");
});

app.listen(MANAGER_SERVICE_PORT, () => {
    console.log(`Manager Service running on port ${MANAGER_SERVICE_PORT}`);
});
