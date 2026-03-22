const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const projectService = require('../services/project-service');
const runtimeService = require('../services/runtime-service');
const config = require('../config');
const killPort = require('../utils/port-killer');
const { validateCommand, safeShellExec } = require('../utils/safe-exec');
const { createSSEManager, createTempFileCleaner } = require('../utils/sse-helper');

// Helper to access runtime
const runtime = runtimeService.runtime;

// 1. Get All Projects (with Real-time Status)
router.get('/', async (req, res) => {
    const projects = projectService.getAll();
    // Merge runtime status and check port usage
    const projectsWithStatus = await Promise.all(projects.map(async p => {
        const running = runtime.isRunning(p.id);
        const portInUse = await projectService.isSystemPortInUse(p.port);

        return {
            ...p,
            status: running ? 'running' : 'stopped',
            portInUse // Boolean: true means something is listening on this port
        };
    }));
    res.json(projectsWithStatus);
});

// 2. Create Project
router.post('/', async (req, res) => {
    const { name, type, mainFile, bindings, envVars, port: customPort, code, filename, buildId, outputDir, buildCommand, deployCommand } = req.body;

    const nameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    if (!nameRegex.test(name)) {
        return res.status(400).json({ error: "项目名称非法：只能包含字母/数字/连字符，且不能以连字符开头或结尾" });
    }

    const projects = projectService.getAll();
    const existing = projects.find(p => p.name === name && p.type === type);
    if (existing) {
        return res.status(400).json({ error: `该类型的项目名称 "${name}" 已存在，请更换名称` });
    }

    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4);

    let port;
    try {
        if (customPort) {
            const portNum = parseInt(customPort);
            const portCheck = await projectService.isPortAvailable(portNum);
            if (!portCheck.valid) {
                return res.status(400).json({ error: portCheck.error });
            }
            port = portNum;
        } else {
            port = await projectService.getAvailablePort();
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }

    let actualMainFile = mainFile;

    if (buildId) {
        // Handle Pre-built Project
        const tempBuildPath = path.join(config.TEMP_BUILD_DIR, buildId);
        const buildOutputPath = outputDir ? path.join(tempBuildPath, outputDir) : tempBuildPath;

        if (!fs.existsSync(buildOutputPath)) {
            return res.status(400).json({ error: "Build artifact expired or invalid" });
        }

        const projectDirName = `page-${name}-${Date.now().toString(36)}`;
        const projectRootPath = path.join(config.UPLOADS_DIR, projectDirName);
        const sourceDir = path.join(projectRootPath, 'source');
        const distDir = path.join(projectRootPath, 'dist');

        try {
            fs.mkdirSync(sourceDir, { recursive: true });
            fs.cpSync(tempBuildPath, sourceDir, { recursive: true });
            try { fs.rmSync(tempBuildPath, { recursive: true, force: true }); } catch { }

            const artifactInSource = outputDir ? path.join(sourceDir, outputDir) : sourceDir;
            fs.cpSync(artifactInSource, distDir, { recursive: true });
        } catch (e) {
            console.error("Failed to setup project directories", e);
            return res.status(500).json({ error: "Failed to create project files: " + e.message });
        }

        actualMainFile = path.join(projectDirName, 'dist');

    } else if (code && filename) {
        const generatedFilename = `${id}-${filename}`;
        const filePath = path.join(config.UPLOADS_DIR, generatedFilename);
        fs.writeFileSync(filePath, code, 'utf8');
        actualMainFile = generatedFilename;
    } else if (!mainFile) {
        return res.status(400).json({ error: "必须提供 mainFile, buildId, 或 code+filename" });
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
        buildCommand: buildCommand || '',
        outputDir: outputDir || '',
        deployCommand: deployCommand || '',
        createdAt: new Date().toISOString()
    };

    projectService.add(newProject);
    res.json(newProject);
});

// 3. Start Project
router.post('/:id/start', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    try {
        // Always force release port to ensure clean startup
        try {
            console.log(`[Start] Ensuring port ${project.port} is free for ${project.name}...`);
            await killPort(project.port);
        } catch (e) {
            console.error(`[Start] Failed to kill port ${project.port}`, e);
        }

        await runtime.start(project);
        project.status = 'running';
        projectService.save();
        res.json({ message: "Project started", project });
    } catch (e) {
        res.status(500).json({ error: "Start failed: " + e.message });
    }
});

// 4. Stop Project
router.post('/:id/stop', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    try {
        await runtime.stop(project.id);
        project.status = 'stopped';
        projectService.save();
        res.json({ message: "Project stopped", project });
    } catch (e) {
        res.status(500).json({ error: "Stop failed: " + e.message });
    }
});

// ... (in delete route) ...
router.delete('/:id', async (req, res) => { // Make async
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    try {
        if (project.status === 'running') {
            runtime.stop(project.id);
        }

        // Force release port just in case (e.g. zombie process or running state mismatch)
        if (project.port) {
            await killPort(project.port);
        }

        // PHYSICAL DELETE: Remove source code and dist folders
        if (project.mainFile) {
            // Support both folders (page-xxx/dist) and single files (worker-xxx.js)
            const parts = project.mainFile.split(/[/\\]/);
            const targetName = parts[0];
            const targetPath = path.join(config.UPLOADS_DIR, targetName);

            // Safety check: ensure targetPath is restricted to UPLOADS_DIR
            const resolvedPath = path.resolve(targetPath);
            const resolvedUploadsDir = path.resolve(config.UPLOADS_DIR);

            if (resolvedPath.startsWith(resolvedUploadsDir) && fs.existsSync(resolvedPath)) {
                console.log(`[Delete] Physically removing ${resolvedPath} for project ${project.name}...`);
                fs.rmSync(resolvedPath, { recursive: true, force: true });
            }
        }
    } catch (e) {
        console.error(`[Delete] Error during cleanup for project ${project.name}:`, e);
    }

    projectService.remove(req.params.id);
    res.json({ message: "Project deleted", id: req.params.id });
});

// 6. Get Project Code
router.get('/:id/code', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const filePath = path.join(config.UPLOADS_DIR, project.mainFile);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Code file not found" });
    }

    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const language = project.mainFile.endsWith('.ts') ? 'typescript' : 'javascript';
        res.json({ code, filename: project.mainFile, language });
    } catch (error) {
        res.status(500).json({ error: "Failed to read code file" });
    }
});

// 7. Update Project Code
router.put('/:id/code', (req, res) => {
    const { code } = req.body;
    const project = projectService.getById(req.params.id);

    if (!project) return res.status(404).json({ error: "Project not found" });
    if (code === undefined || code === null) return res.status(400).json({ error: "Code is required" });

    const filePath = path.join(config.UPLOADS_DIR, project.mainFile);

    // Safety check: prevent escaping uploads dir (basic)
    if (!filePath.startsWith(config.UPLOADS_DIR)) {
        return res.status(400).json({ error: "Invalid file path" });
    }

    try {
        fs.writeFileSync(filePath, code, 'utf8');
        // Restart logic if running...
        // The original server.js didn't auto-restart on code update?
        // Wait, `server.js` lines 1094+ ...
        // It DOES restart:
        /*
        if (project.status === 'running') {
            runtime.stop(project.id);
            runtime.start(project);
        }
        */
        // Let's implement that.
        if (project.status === 'running') {
            runtime.stop(project.id);
            runtime.start(project).catch(e => console.error("Restart failed", e));
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to save code: " + e.message });
    }
});

// 8. Rebuild Project (SSE)
router.post('/:id/rebuild', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let { buildCommand, outputDir, deployCommand } = req.body;

    if (buildCommand) project.buildCommand = buildCommand;
    else buildCommand = project.buildCommand;

    if (outputDir) project.outputDir = outputDir;
    else outputDir = project.outputDir;

    if (deployCommand) project.deployCommand = deployCommand;
    else deployCommand = project.deployCommand;

    projectService.save();

    // 创建 SSE 管理器（带超时和心跳）
    const sse = createSSEManager(res, {
        timeout: 30 * 60 * 1000,
        heartbeatInterval: 30 * 1000,
        onClose: () => console.log('[Rebuild] SSE connection closed')
    });

    try {
        let relativeRoot = path.dirname(project.mainFile);
        if (relativeRoot === '.') relativeRoot = project.mainFile;

        const projectRootPath = path.join(config.UPLOADS_DIR, relativeRoot);
        const sourceDir = fs.existsSync(path.join(projectRootPath, 'source'))
            ? path.join(projectRootPath, 'source')
            : projectRootPath;
        const distDir = path.join(projectRootPath, 'dist');

        const { flattenDirectory } = require('../utils/fs-helper');
        flattenDirectory(sourceDir);

        sse.sendLog(`Starting rebuild for project: ${project.name}`);
        sse.sendLog(`Work directory: ${sourceDir}`);

        const runCmd = async (cmd, cwd) => {
            // 安全验证命令
            const validation = validateCommand(cmd);
            if (!validation.valid) {
                throw new Error(`不安全的命令被拒绝: ${validation.error}`);
            }
            
            sse.sendLog(`> ${cmd}`);
            
            try {
                await safeShellExec(cmd, { cwd, timeout: 600000 }, 
                    (out) => sse.sendLog(out),
                    (err) => sse.sendLog(err)
                );
            } catch (e) {
                throw new Error(`命令执行失败: ${e.message}`);
            }
        };

        // 0. Deep Cleanup: Remove .wrangler cache to prevent accumulation of temp files
        const wranglerDir = path.join(sourceDir, '.wrangler');
        if (fs.existsSync(wranglerDir)) {
            sse.sendLog("🧹 Cleaning up .wrangler cache and temporary files...");
            try {
                fs.rmSync(wranglerDir, { recursive: true, force: true });
            } catch (err) {
                sse.sendLog(`⚠️ Warning: Failed to clean .wrangler directory: ${err.message}`);
            }
        }

        // 1. Check Dependencies
        if (fs.existsSync(path.join(sourceDir, 'package.json')) && !fs.existsSync(path.join(sourceDir, 'node_modules'))) {
            sse.sendLog("📦 Missing node_modules, installing dependencies...");
            const installCmd = fs.existsSync(path.join(sourceDir, 'yarn.lock')) ? 'yarn install' : 'npm install';
            await runCmd(installCmd, sourceDir);
        }

        // 2. Build Command
        if (buildCommand) {
            sse.sendLog("🚀 Running build command...");
            await runCmd(buildCommand, sourceDir);
            sse.sendLog("✅ Build successful.");
        } else {
            sse.sendLog("ℹ️ No build command specified, skipping build step.");
        }

        // 3. Sync to Dist (if it's a build-flow project with dist folder)
        if (fs.existsSync(path.join(projectRootPath, 'source')) && fs.existsSync(distDir)) {
            // Clear dist directory before syncing to ensure no stale files remain
            const artifactSource = outputDir ? path.join(sourceDir, outputDir) : sourceDir;
            if (!fs.existsSync(artifactSource)) {
                throw new Error(`Output directory '${outputDir}' not found at ${artifactSource}`);
            }

            if (fs.existsSync(distDir)) {
                sse.sendLog("🧹 Clearing old deployment artifacts...");
                fs.rmSync(distDir, { recursive: true, force: true });
            }
            fs.mkdirSync(distDir, { recursive: true });

            // Simple copy (now into a fresh directory)
            fs.cpSync(artifactSource, distDir, { recursive: true });
            sse.sendLog("✨ Sync complete.");
        }

        // 4. Restart Project
        if (project.status === 'running') {
            sse.sendLog("🔄 Restarting project to apply changes...");
            try {
                await runtime.stop(project.id);
                await runtime.start(project);
                sse.sendLog("🚀 Project restarted successfully!");
            } catch (reErr) {
                sse.sendLog(`⚠️ Restart error: ${reErr.message}`);
                throw reErr;
            }
        }

        sse.sendResult({ success: true });
        sse.close();

    } catch (e) {
        console.error("Rebuild error:", e);
        sse.sendError(e.message);
        sse.close();
    }
});

// 8b. Deploy Build Artifact to Project (SSE)
router.post('/:id/deploy', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { buildId, outputDir } = req.body;
    if (!buildId) return res.status(400).json({ error: "buildId is required" });

    // 创建 SSE 管理器（带超时和心跳）
    const sse = createSSEManager(res, {
        timeout: 30 * 60 * 1000,
        heartbeatInterval: 30 * 1000,
        onClose: () => console.log('[Deploy] SSE connection closed')
    });

    try {
        const tempBuildPath = path.join(config.TEMP_BUILD_DIR, buildId);
        const artifactSource = outputDir ? path.join(tempBuildPath, outputDir) : tempBuildPath;

        if (!fs.existsSync(artifactSource)) {
            throw new Error(`Artifact directory '${outputDir}' not found at ${artifactSource}`);
        }

        let relativeRoot = path.dirname(project.mainFile);
        if (relativeRoot === '.') relativeRoot = project.mainFile;
        const projectRootPath = path.join(config.UPLOADS_DIR, relativeRoot);

        // 创建临时文件清理器
        const cleaner = createTempFileCleaner([tempBuildPath]);

        // 1. Reset Source Directory: Ensure IDE and build are perfectly synced with latest upload
        const sourceDir = path.join(projectRootPath, 'source');
        if (fs.existsSync(sourceDir)) {
            sse.sendLog("🧹 Clearing old source code...");
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
        fs.mkdirSync(sourceDir, { recursive: true });

        // Copy new source from temp build
        sse.sendLog("🚚 Syncing new source code to project...");
        fs.cpSync(tempBuildPath, sourceDir, { recursive: true });

        // 2. Reset Dist Directory: Ensure a clean deployment environment
        const distDir = path.join(projectRootPath, 'dist');
        sse.sendLog("🚚 Syncing build artifacts to deployment directory...");

        // Clear dist directory before syncing to ensure no stale files remain
        if (fs.existsSync(distDir)) {
            sse.sendLog("🧹 Clearing old deployment artifacts...");
            fs.rmSync(distDir, { recursive: true, force: true });
        }
        fs.mkdirSync(distDir, { recursive: true });

        // Copy new artifacts from temp build (now into a fresh directory)
        fs.cpSync(artifactSource, distDir, { recursive: true });

        // Clean up temp build
        await cleaner.cleanup();
        sse.sendLog("✨ Sync complete.");

        // 4. Restart Project
        if (project.status === 'running') {
            sse.sendLog("🔄 Restarting project to apply changes...");
            await runtime.stop(project.id);
            await runtime.start(project);
            sse.sendLog("🚀 Project restarted successfully!");
        }

        sse.sendResult({ success: true });
        sse.close();

    } catch (e) {
        console.error("Deploy error:", e);
        sse.sendError(e.message);
        sse.close();
    }
});

// 9. Update Project Config (Bindings, Env Vars, Port)
router.patch('/:id', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { bindings, envVars, port, buildCommand, outputDir, deployCommand } = req.body;
    let needsRestart = false;

    if (buildCommand !== undefined) project.buildCommand = buildCommand;
    if (outputDir !== undefined) project.outputDir = outputDir;
    if (deployCommand !== undefined) project.deployCommand = deployCommand;

    if (bindings) {
        project.bindings = bindings;
        needsRestart = true;
    }
    if (envVars) {
        project.envVars = envVars;
        needsRestart = true;
    }
    if (port && port !== project.port) {
        // Check availability
        const check = await projectService.isPortAvailable(parseInt(port), project.id);
        if (!check.valid) return res.status(400).json({ error: check.error });
        project.port = parseInt(port);
        needsRestart = true;
    }

    projectService.save();

    if (needsRestart && project.status === 'running') {
        runtime.stop(project.id);
        await runtime.start(project);
    }

    res.json({ success: true, project });
});

module.exports = router;
