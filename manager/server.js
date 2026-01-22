const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../.platform-data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const RESOURCES_FILE = path.join(DATA_DIR, 'resources.json');
const D1_DIR = path.join(DATA_DIR, 'd1-databases');

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

function saveProjects() {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// Init Resources DB
let resources = { kv: [], d1: [] };
if (fs.existsSync(RESOURCES_FILE)) {
    try {
        resources = JSON.parse(fs.readFileSync(RESOURCES_FILE, 'utf8'));
    } catch (e) {
        console.error("Failed to load resources", e);
    }
}

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

// Init Runtime
const runtime = new ProjectRuntime(UPLOADS_DIR, resources);

// Update runtime resources reference when they change
function updateRuntimeResources() {
    runtime.resources = resources;
}

// Restart running projects on boot
projects.forEach(p => {
    if (p.status === 'running') {
        console.log(`[Auto-Start] Restoring project ${p.name}...`);
        runtime.start(p);
    }
});

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
 * 验证端口是否可用
 * @param {number} port - 要验证的端口
 * @param {string} excludeProjectId - 排除的项目 ID（用于更新场景）
 * @returns {{valid: boolean, error?: string}}
 */
function isPortAvailable(port, excludeProjectId = null) {
    // 检查端口范围
    if (port < 1024 || port > 65535) {
        return { valid: false, error: "端口必须在 1024-65535 范围内" };
    }

    // 检查是否被其他项目占用
    const existingProject = projects.find(p =>
        p.port === port && p.id !== excludeProjectId
    );

    if (existingProject) {
        return {
            valid: false,
            error: `端口 ${port} 已被项目 "${existingProject.name}" 占用`
        };
    }

    return { valid: true };
}

/**
 * 获取可用端口
 * @param {number} preferredPort - 首选端口
 * @returns {number} 可用端口
 */
function getAvailablePort(preferredPort = null) {
    // 如果指定了首选端口且可用，使用它
    if (preferredPort) {
        const check = isPortAvailable(preferredPort);
        if (check.valid) return preferredPort;
    }

    // 否则从起始范围开始寻找
    const startPort = parseInt(process.env.PORT_RANGE_START || 8000);
    const endPort = parseInt(process.env.PORT_RANGE_END || 9000);

    let port = startPort;
    while (port <= endPort) {
        if (isPortAvailable(port).valid) {
            return port;
        }
        port++;
    }

    // 如果范围内没有可用端口，抛出错误
    throw new Error("没有可用端口");
}

// === PROJECT MANAGEMENT API ===

// 2. Create Project
app.post('/api/projects', (req, res) => {
    console.log('[DEBUG] Create Project Request Body:', JSON.stringify(req.body, null, 2));
    const { name, type, mainFile, bindings, envVars, port: customPort, code, filename } = req.body;
    console.log(`[DEBUG] Parsed: name=${name}, type=${type}, mainFile=${mainFile}, codeLen=${code ? code.length : 0}, filename=${filename}`);

    // Simple ID gen
    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4);

    // 端口处理：验证自定义端口或自动分配
    let port;
    try {
        if (customPort) {
            // 用户指定了端口，验证是否可用
            const portNum = parseInt(customPort);
            const portCheck = isPortAvailable(portNum);
            if (!portCheck.valid) {
                return res.status(400).json({ error: portCheck.error });
            }
            port = portNum;
        } else {
            // 自动分配可用端口
            port = getAvailablePort();
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

    try {
        await runtime.start(project);
        project.status = 'running';
        saveProjects();
        res.json({ message: "Project started", project });
    } catch (e) {
        console.error("Start failed", e);
        res.status(500).json({ error: "Failed to start project" });
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
        bindings: project.bindings || { kv: [], d1: [] },
        envVars: maskSecrets(project.envVars || {}),
        envVarsRaw: project.envVars || {},
        port: project.port,
        name: project.name,
        type: project.type
    });
});



// 11. Update Project Configuration (bindings and envVars)
app.put('/api/projects/:id/config', (req, res) => {
    const { bindings, envVars, port } = req.body;
    const project = projects.find(p => p.id === req.params.id);

    if (!project) return res.status(404).json({ error: "Project not found" });

    // 更新端口
    if (port !== undefined && port !== project.port) {
        const portNum = parseInt(port);
        // 如果是新端口，检查可用性
        const check = isPortAvailable(portNum);
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

app.listen(PORT, () => {
    console.log(`Manager Service running on port ${PORT}`);
});
