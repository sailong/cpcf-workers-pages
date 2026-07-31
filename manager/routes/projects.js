const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const upload = require('../middleware/upload');
const projectService = require('../services/project-service');
const runtimeService = require('../services/runtime-service');
const config = require('../config');
const { createRecordedSSEManager, createTempFileCleaner } = require('../utils/sse-helper');
const { resolveWithin } = require('../utils/path-helper');
const cryptoHelper = require('../utils/crypto-helper');
const releaseService = require('../services/release-service');
const deploymentService = require('../services/deployment-service');
const auditService = require('../services/audit-service');
const runtimeLogService = require('../services/runtime-log-service');
const { projectConcurrencyGate } = require('../middleware/project-concurrency');
const { normalizeProjectLimits } = require('../services/project-limits');
const { errorStatus } = require('../utils/http-error');
const { normalizeProjectCompatibility } = require('../services/project-compatibility');
const { getReleaseRoot, isReleasePath, resolveProjectPath } = require('../utils/project-paths');
const { assertPathWithinByteLimit, assertWithinByteLimit, getDirectorySize } = require('../utils/fs-helper');
const { validateProjectName } = require('../utils/project-hostname');
const { applyProjectUpdate } = require('../services/project-update-service');
const { projectOperationCoordinator } = require('../services/project-operation-coordinator');

function serializeProjectOperation(kind, handler) {
    return async (req, res, next) => {
        try {
            return await projectOperationCoordinator.run(req.params.id, kind, () => handler(req, res, next));
        } catch (error) {
            if (res.headersSent) return next(error);
            return res.status(error.statusCode || 500).json({
                error: error.publicMessage || error.message,
                activeOperation: error.activeOperation
            });
        }
    };
}

function resolveInstallCommand(workDirectory) {
    if (fs.existsSync(path.join(workDirectory, 'pnpm-lock.yaml'))) return 'pnpm install --frozen-lockfile';
    if (fs.existsSync(path.join(workDirectory, 'yarn.lock'))) return 'yarn install --frozen-lockfile';
    if (fs.existsSync(path.join(workDirectory, 'package-lock.json'))) return 'npm ci';
    return null;
}


function assertCreateArtifactWithinLimits(artifactPath, sourcePath, projectLimits, code) {
    const artifactBytes = getDirectorySize(artifactPath);
    const sourceBytes = sourcePath === artifactPath ? artifactBytes : getDirectorySize(sourcePath);
    const totalBytes = sourcePath === artifactPath ? artifactBytes : artifactBytes + sourceBytes;
    const uploadLimitBytes = projectLimits.uploadMb * 1024 * 1024;
    const diskLimitBytes = projectLimits.diskMb * 1024 * 1024;
    assertPathWithinByteLimit(artifactPath, uploadLimitBytes, `Uploaded project exceeds upload limit (${projectLimits.uploadMb} MB)`);
    if (totalBytes > diskLimitBytes) {
        const error = new Error(`Uploaded project exceeds disk limit (${projectLimits.diskMb} MB)`);
        error.statusCode = 413;
        throw error;
    }
    if (typeof code === 'string' && Buffer.byteLength(code, 'utf8') > uploadLimitBytes) {
        const error = new Error(`Uploaded project exceeds upload limit (${projectLimits.uploadMb} MB)`);
        error.statusCode = 413;
        throw error;
    }
    return { artifactBytes, sourceBytes, totalBytes };
}


// Helper to access runtime
const runtime = runtimeService.runtime;
const candidatePorts = new Set();

async function reserveCandidatePort() {
    const startPort = parseInt(process.env.PORT_RANGE_START || 10000, 10);
    const endPort = parseInt(process.env.PORT_RANGE_END || 20000, 10);
    for (let port = startPort; port <= endPort; port += 1) {
        if (candidatePorts.has(port)) continue;
        const availability = await projectService.isPortAvailable(port);
        if (availability.valid && !candidatePorts.has(port)) {
            candidatePorts.add(port);
            return port;
        }
    }
    throw new Error('No port is available for release validation');
}

async function validateCandidateRelease(project, release) {
    const port = await reserveCandidatePort();
    const runtimeKey = `candidate-${crypto.randomUUID()}`;
    const candidate = {
        ...project,
        mainFile: release.entryPath,
        port,
        status: 'stopped'
    };
    try {
        await runtime.start(candidate, { runtimeKey, readinessTimeoutMs: 20_000 });
    } finally {
        await runtime.stop(runtimeKey);
        candidatePorts.delete(port);
    }
}

function validationOptions(project) {
    return { beforeActivate: release => validateCandidateRelease(project, release) };
}

function prepareEnvVars(envVars, projectId, existing = {}) {
    const prepared = {};
    for (const [key, varData] of Object.entries(envVars || {})) {
        const validation = cryptoHelper.validateEnvVar(key, varData && varData.value, varData && varData.type);
        if (!validation.valid) throw new Error(validation.error);
        if (varData.type === 'secret') {
            if (varData.value === '******' && existing[key] && existing[key].type === 'secret') {
                prepared[key] = existing[key];
            } else {
                prepared[key] = { ...varData, value: cryptoHelper.encryptSecret(varData.value, projectId) };
            }
        } else {
            prepared[key] = varData;
        }
    }
    return prepared;
}

function migrateStoredSecrets(project) {
    let changed = false;
    for (const varData of Object.values(project.envVars || {})) {
        if (!varData || varData.type !== 'secret' || typeof varData.value !== 'string') continue;
        const result = cryptoHelper.migrateStoredSecret(varData.value, project.id);
        if (result.migrated) {
            varData.value = result.ciphertext;
            changed = true;
        }
    }
    if (changed) projectService.update(project.id, { envVars: project.envVars });
}

function publicProject(project) {
    migrateStoredSecrets(project);
    const { deployCommand: _legacyDeployCommand, ...safeProject } = project;
    return { ...safeProject, envVars: cryptoHelper.maskSecrets(project.envVars) };
}

async function switchReleaseAndRestart(project, switchRelease) {
    const wasRunning = project.status === 'running' || runtime.isRunning(project.id);
    const release = await switchRelease();
    if (!release) return null;

    if (wasRunning) {
        await runtime.stop(project.id);
        try {
            await runtime.start(projectService.getById(project.id));
        } catch (error) {
            if (release.previousReleaseId) {
                await releaseService.activate(project.id, release.previousReleaseId, 'failed-runtime-revert');
                try {
                    await runtime.start(projectService.getById(project.id));
                    projectService.update(project.id, { status: 'running' });
                } catch {
                    projectService.update(project.id, { status: 'stopped' });
                }
            } else {
                projectService.update(project.id, { status: 'stopped' });
            }
            throw error;
        }
    }
    return release;
}

async function rebuildImmutableRelease(project, options, sse) {
    const releaseRoot = getReleaseRoot(project.mainFile);
    const activeSource = resolveWithin(releaseRoot, 'source');
    if (!fs.existsSync(activeSource)) throw new Error('Active release source is missing');

    const operationRoot = resolveWithin(config.TEMP_BUILD_DIR, `rebuild-${crypto.randomUUID()}`);
    const sourceSnapshot = resolveWithin(operationRoot, 'source');
    const workDir = resolveWithin(operationRoot, 'work');
    fs.mkdirSync(operationRoot, { recursive: true, mode: 0o700 });
    try {
        const buildDeadline = Date.now() + project.limits.buildTimeoutSeconds * 1000;
        fs.cpSync(activeSource, sourceSnapshot, { recursive: true });
        fs.cpSync(activeSource, workDir, { recursive: true });
        const { flattenDirectory } = require('../utils/fs-helper');
        flattenDirectory(workDir);

        const runCommand = async command => {
            const remainingMs = buildDeadline - Date.now();
            if (remainingMs <= 0) throw new Error('Build time limit exceeded');
            sse.sendLog(`> ${command}`);
            await runtime.runBuild(project, command, {
                cwd: workDir,
                timeout: remainingMs,
                onStdout: output => sse.sendLog(output),
                onStderr: error => sse.sendLog(error)
            });
        };

        if (fs.existsSync(path.join(workDir, 'package.json')) && !fs.existsSync(path.join(workDir, 'node_modules'))) {
            {
                const installCommand = resolveInstallCommand(workDir);
                if (!installCommand) {
                    throw new Error('Missing lockfile for dependency install; upload package-lock.json, yarn.lock, or pnpm-lock.yaml');
                }
                await runCommand(installCommand);
            }
        }
        if (options.buildCommand) await runCommand(options.buildCommand);

        const artifactPath = options.outputDir
            ? resolveWithin(workDir, options.outputDir, { allowBase: true })
            : workDir;
        if (!fs.existsSync(artifactPath)) throw new Error(`Output directory '${options.outputDir}' was not produced`);

        return await switchReleaseAndRestart(project, () => releaseService.create(project.id, {
            sourcePath: sourceSnapshot,
            artifactPath,
            reason: 'rebuild',
            metadata: { projectType: project.type, buildCommand: options.buildCommand, outputDir: options.outputDir },
            ...validationOptions(project)
        }));
    } finally {
        fs.rmSync(operationRoot, { recursive: true, force: true });
    }
}

async function deployImmutableBuild(project, buildId, outputDir) {
    const tempBuildPath = resolveWithin(config.TEMP_BUILD_DIR, buildId);
    const artifactPath = outputDir
        ? resolveWithin(tempBuildPath, outputDir, { allowBase: true })
        : tempBuildPath;
    if (!fs.existsSync(artifactPath)) throw new Error(`Artifact directory '${outputDir}' not found`);
    try {
        return await switchReleaseAndRestart(project, () => releaseService.create(project.id, {
            sourcePath: tempBuildPath,
            artifactPath,
            reason: 'deploy',
            metadata: { projectType: project.type, buildId, outputDir },
            ...validationOptions(project)
        }));
    } finally {
        fs.rmSync(tempBuildPath, { recursive: true, force: true });
    }
}

function cleanupInitialProjectFiles(options = {}) {
    const filesystem = options.fs || fs;
    const settings = options.config || config;
    const resolvePath = options.resolveWithin || resolveWithin;
    const targets = new Set();

    const addTarget = (base, value) => {
        if (!value) return;
        try {
            targets.add(resolvePath(base, value, { allowBase: true }));
        } catch (error) {
            (options.logger || console).warn(`[Cleanup] Skipping invalid path: ${error.message}`);
        }
    };

    if (options.actualMainFile) {
        addTarget(settings.UPLOADS_DIR, options.actualMainFile.split(/[/\\]/)[0]);
    }
    if (options.buildId) addTarget(settings.TEMP_BUILD_DIR, options.buildId);

    for (const target of targets) {
        filesystem.rmSync(target, { recursive: true, force: true });
    }
}

// 1. Get All Projects (with Real-time Status)
router.get('/', async (req, res) => {
    const projects = projectService.getAll();
    // Merge runtime status and check port usage
    const projectsWithStatus = await Promise.all(projects.map(async p => {
        const running = runtime.isRunning(p.id);
        const portInUse = await projectService.isSystemPortInUse(p.port);

        return {
            ...publicProject(p),
            status: running ? 'running' : 'stopped',
            portInUse, // Boolean: true means something is listening on this port
            metrics: runtimeService.getProjectMetrics(p, projectConcurrencyGate.count(p.id)),
            lastDeployment: deploymentService.list(p.id, 1)[0] || null
        };
    }));
    res.json(projectsWithStatus);
});

// 2. Create Project
router.post('/', async (req, res) => {
    const { name, type, mainFile, bindings, envVars, limits, compatibilityDate, compatibilityFlags, port: customPort, code, filename, buildId, outputDir, buildCommand } = req.body;

    try {
        validateProjectName(name, type);
    } catch (error) {
        return res.status(error.statusCode || 400).json({ error: error.message });
    }
    try {
        projectService.validateBindings(bindings || {});
    } catch (error) {
        return res.status(error.statusCode || 400).json({ error: error.message });
    }

    const projects = projectService.getAll();
    const existing = projects.find(p => p.name.toLowerCase() === name.toLowerCase() && p.type === type);
    if (existing) {
        return res.status(400).json({ error: `该类型的项目名称 "${name}" 已存在，请更换名称` });
    }

    const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomUUID()}`;

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
        const tempBuildPath = resolveWithin(config.TEMP_BUILD_DIR, buildId);
        const buildOutputPath = outputDir ? resolveWithin(tempBuildPath, outputDir, { allowBase: true }) : tempBuildPath;

        if (!fs.existsSync(buildOutputPath)) {
            return res.status(400).json({ error: "Build artifact expired or invalid" });
        }

        const projectDirName = `page-${name}-${crypto.randomUUID()}`;
        const projectRootPath = resolveWithin(config.UPLOADS_DIR, projectDirName);
        const sourceDir = resolveWithin(projectRootPath, 'source');
        const distDir = resolveWithin(projectRootPath, 'dist');

        try {
            fs.mkdirSync(sourceDir, { recursive: true });
            fs.cpSync(tempBuildPath, sourceDir, { recursive: true });
            try { fs.rmSync(tempBuildPath, { recursive: true, force: true }); } catch { }

            const artifactInSource = outputDir ? resolveWithin(sourceDir, outputDir, { allowBase: true }) : sourceDir;
            fs.cpSync(artifactInSource, distDir, { recursive: true });
        } catch (e) {
            console.error("Failed to setup project directories", e);
            cleanupInitialProjectFiles({
                actualMainFile: path.join(projectDirName, 'dist'),
                buildId
            });
            return res.status(500).json({ error: "Failed to create project files: " + e.message });
        }

        actualMainFile = path.join(projectDirName, 'dist');

    } else if (code && filename) {
        if (path.basename(filename) !== filename) {
            return res.status(400).json({ error: "Filename must not contain a path" });
        }
        const generatedFilename = `${id}-${filename}`;
        const filePath = resolveWithin(config.UPLOADS_DIR, generatedFilename);
        fs.writeFileSync(filePath, code, 'utf8');
        actualMainFile = generatedFilename;
    } else if (!mainFile) {
        return res.status(400).json({ error: "必须提供 mainFile, buildId, 或 code+filename" });
    } else {
        try {
            resolveWithin(config.UPLOADS_DIR, mainFile);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    let projectLimits;
    let compatibility;
    try {
        projectLimits = normalizeProjectLimits(limits || {});
        compatibility = normalizeProjectCompatibility({ compatibilityDate, compatibilityFlags });
    } catch (error) {
        cleanupInitialProjectFiles({ actualMainFile, buildId });
        return res.status(400).json({ error: error.message });
    }

    try {
        const artifactPath = resolveWithin(config.UPLOADS_DIR, actualMainFile);
        const sourceCandidate = fs.existsSync(artifactPath) && fs.statSync(artifactPath).isDirectory()
            ? path.join(path.dirname(artifactPath), 'source')
            : artifactPath;
        const sourcePath = fs.existsSync(sourceCandidate) ? sourceCandidate : artifactPath;
        assertCreateArtifactWithinLimits(artifactPath, sourcePath, projectLimits, code);
    } catch (error) {
        cleanupInitialProjectFiles({ actualMainFile, buildId });
        return res.status(error.statusCode || 400).json({ error: error.message });
    }

    let newProject;
    try {
        newProject = {
            id,
            name,
            type,
            port,
            status: 'stopped',
            mainFile: actualMainFile,
            bindings: bindings || {},
            envVars: prepareEnvVars(envVars || {}, id),
            buildCommand: buildCommand || '',
            outputDir: outputDir || '',
            limits: projectLimits,
            ...compatibility,
            createdAt: new Date().toISOString()
        };
        projectService.add(newProject);
        const artifactPath = resolveWithin(config.UPLOADS_DIR, actualMainFile);
        const sourceCandidate = fs.statSync(artifactPath).isDirectory()
            ? path.join(path.dirname(artifactPath), 'source')
            : artifactPath;
        const sourcePath = fs.existsSync(sourceCandidate) ? sourceCandidate : artifactPath;
        const release = await releaseService.create(id, {
            sourcePath,
            artifactPath,
            reason: 'initial-upload',
            metadata: { filename: path.basename(actualMainFile), projectType: type },
            ...validationOptions(projectService.getById(id))
        });

        const legacyRoot = resolveWithin(config.UPLOADS_DIR, actualMainFile.split(/[/\\]/)[0]);
        fs.rmSync(legacyRoot, { recursive: true, force: true });
        auditService.record('project.create', 'project', id, { name, type, releaseId: release.id });
        res.json(publicProject(projectService.getById(id)));
    } catch (error) {
        projectService.remove(id);
        cleanupInitialProjectFiles({ actualMainFile, buildId });
        console.error('[Release] Initial activation failed:', error);
        res.status(500).json({ error: `Failed to activate initial release: ${error.message}` });
    }
});

// 3. Start Project
router.post('/:id/start', serializeProjectOperation('start', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    try {
        const portCheck = await projectService.isPortAvailable(project.port, project.id);
        if (!portCheck.valid) return res.status(409).json({ error: portCheck.error });

        await runtime.start(project);
        const updated = projectService.update(project.id, { status: 'running' });
        auditService.record('project.start', 'project', project.id, { name: project.name });
        res.json({ message: "Project started", project: updated });
    } catch (e) {
        res.status(500).json({ error: "Start failed: " + e.message });
    }
}));

// 4. Stop Project
router.post('/:id/stop', serializeProjectOperation('stop', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    try {
        await runtime.stop(project.id);
        const updated = projectService.update(project.id, { status: 'stopped' });
        auditService.record('project.stop', 'project', project.id, { name: project.name });
        res.json({ message: "Project stopped", project: updated });
    } catch (e) {
        res.status(500).json({ error: "Stop failed: " + e.message });
    }
}));

function createDeleteProjectHandler(options = {}) {
    const projects = options.projectService || projectService;
    const projectRuntime = options.runtime || runtime;
    const filesystem = options.fs || fs;
    const settings = options.config || config;
    const audit = options.auditService || auditService;
    const resolvePath = options.resolveWithin || resolveWithin;
    const releasePath = options.isReleasePath || isReleasePath;

    return async (req, res) => {
    const project = projects.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    try {
        await projectRuntime.stop(project.id);
        projects.update(project.id, { status: 'stopped' });

        // PHYSICAL DELETE: Remove source code and dist folders
        if (project.mainFile) {
            if (releasePath(project.mainFile)) {
                const projectStorage = resolvePath(settings.PROJECTS_DIR, project.id);
                filesystem.rmSync(projectStorage, { recursive: true, force: true });
            } else {
            // Support both folders (page-xxx/dist) and single files (worker-xxx.js)
            const parts = project.mainFile.split(/[/\\]/);
            const targetName = parts[0];
            const resolvedPath = resolvePath(settings.UPLOADS_DIR, targetName);

            if (filesystem.existsSync(resolvedPath)) {
                console.log(`[Delete] Physically removing ${resolvedPath} for project ${project.name}...`);
                filesystem.rmSync(resolvedPath, { recursive: true, force: true });
            }
            }
        }
    } catch (e) {
        console.error(`[Delete] Error during cleanup for project ${project.name}:`, e);
        return res.status(500).json({ error: `Project cleanup failed; the project was retained for retry: ${e.message}` });
    }

    projects.remove(req.params.id);
    audit.record('project.delete', 'project', project.id, { name: project.name, type: project.type });
    res.json({ message: "Project deleted", id: req.params.id });
    };
}

router.delete('/:id', serializeProjectOperation('delete', createDeleteProjectHandler()));

// 6. Get Project Code
router.get('/:id/code', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let filePath;
    try {
        filePath = resolveProjectPath(project.mainFile);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
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
router.put('/:id/code', serializeProjectOperation('code-update', async (req, res) => {
    const { code } = req.body;
    const project = projectService.getById(req.params.id);

    if (!project) return res.status(404).json({ error: "Project not found" });
    if (code === undefined || code === null) return res.status(400).json({ error: "Code is required" });
    if (typeof code !== 'string') return res.status(400).json({ error: "Code must be a string" });

    if (project.type !== 'worker') return res.status(400).json({ error: 'Use the project file editor for Pages releases' });
    const temporaryDir = resolveWithin(config.TEMP_BUILD_DIR, `release-edit-${crypto.randomUUID()}`);
    try {
        assertWithinByteLimit(
            Buffer.byteLength(code, 'utf8'),
            project.limits.uploadMb * 1024 * 1024,
            `Uploaded code exceeds upload limit (${project.limits.uploadMb} MB)`
        );
        fs.mkdirSync(temporaryDir, { recursive: true, mode: 0o700 });
        const filename = path.basename(project.mainFile);
        const candidate = resolveWithin(temporaryDir, filename);
        fs.writeFileSync(candidate, code, { encoding: 'utf8', mode: 0o600 });
        const release = await releaseService.create(project.id, {
            sourcePath: candidate,
            artifactPath: candidate,
            reason: 'code-update',
            metadata: { filename, projectType: project.type },
            ...validationOptions(project)
        });

        if (project.status === 'running') {
            await runtime.stop(project.id);
            try {
                await runtime.start(projectService.getById(project.id));
            } catch (error) {
                if (release.previousReleaseId) await releaseService.activate(project.id, release.previousReleaseId, 'failed-activation-revert');
                const reverted = projectService.getById(project.id);
                try {
                    await runtime.start(reverted);
                    projectService.update(project.id, { status: 'running' });
                } catch {
                    projectService.update(project.id, { status: 'stopped' });
                }
                throw error;
            }
        }

        res.json({ success: true, release });
    } catch (e) {
        res.status(e.statusCode || 500).json({ error: "Failed to save code: " + e.message });
    } finally {
        fs.rmSync(temporaryDir, { recursive: true, force: true });
    }
}));

// 8. Rebuild Project (SSE)
router.post('/:id/rebuild', serializeProjectOperation('rebuild', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    let { buildCommand, outputDir } = req.body;

    buildCommand = buildCommand || project.buildCommand;
    outputDir = outputDir || project.outputDir;
    projectService.update(project.id, { buildCommand, outputDir });
    const deployment = deploymentService.createRecorder(project.id, 'rebuild', { buildCommand, outputDir });

    // 创建 SSE 管理器（带超时和心跳）
    const sse = createRecordedSSEManager(res, deployment, {
        timeout: 30 * 60 * 1000,
        heartbeatInterval: 30 * 1000,
        onClose: () => {
            console.log('[Rebuild] SSE connection closed');
        }
    });

    if (isReleasePath(project.mainFile)) {
        try {
            sse.sendLog(`Building immutable release for project: ${project.name}`);
            const release = await rebuildImmutableRelease(project, { buildCommand, outputDir }, sse);
            sse.sendResult({ success: true, release });
        } catch (error) {
            console.error('Immutable rebuild error:', error);
            sse.sendError(error.message);
        } finally {
            sse.close();
        }
        return;
    }

    try {
        const buildDeadline = Date.now() + project.limits.buildTimeoutSeconds * 1000;
        let relativeRoot = path.dirname(project.mainFile);
        if (relativeRoot === '.') relativeRoot = project.mainFile;

        const projectRootPath = resolveWithin(config.UPLOADS_DIR, relativeRoot);
        const candidateSourceDir = resolveWithin(projectRootPath, 'source');
        const sourceDir = fs.existsSync(candidateSourceDir)
            ? candidateSourceDir
            : projectRootPath;
        const distDir = resolveWithin(projectRootPath, 'dist');

        const { flattenDirectory } = require('../utils/fs-helper');
        flattenDirectory(sourceDir);

        sse.sendLog(`Starting rebuild for project: ${project.name}`);
        sse.sendLog(`Work directory: ${sourceDir}`);

        const runCmd = async (cmd, cwd) => {
            sse.sendLog(`> ${cmd}`);
            
            const remainingMs = buildDeadline - Date.now();
            if (remainingMs <= 0) throw new Error('Build time limit exceeded');
            try {
                await runtime.runBuild(project, cmd, {
                    cwd,
                    timeout: remainingMs,
                    onStdout: out => sse.sendLog(out),
                    onStderr: err => sse.sendLog(err)
                });
            } catch (e) {
                throw new Error(`命令执行失败: ${e.message}`);
            }
        };

        // 0. Deep Cleanup: Remove .wrangler cache to prevent accumulation of temp files
        const wranglerDir = resolveWithin(sourceDir, '.wrangler');
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
            const installCmd = resolveInstallCommand(sourceDir);
            if (!installCmd) {
                throw new Error('Missing lockfile for dependency install; upload package-lock.json, yarn.lock, or pnpm-lock.yaml');
            }
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
            const artifactSource = outputDir ? resolveWithin(sourceDir, outputDir, { allowBase: true }) : sourceDir;
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
}));

// 8b. Deploy Build Artifact to Project (SSE)
router.post('/:id/deploy', serializeProjectOperation('deploy', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { buildId, outputDir } = req.body;
    if (!buildId) return res.status(400).json({ error: "buildId is required" });
    const deployment = deploymentService.createRecorder(project.id, 'deploy', { buildId, outputDir });

    // 创建 SSE 管理器（带超时和心跳）
    const sse = createRecordedSSEManager(res, deployment, {
        timeout: 30 * 60 * 1000,
        heartbeatInterval: 30 * 1000,
        onClose: () => {
            console.log('[Deploy] SSE connection closed');
        }
    });

    if (isReleasePath(project.mainFile)) {
        try {
            sse.sendLog('Activating immutable build artifact...');
            const release = await deployImmutableBuild(project, buildId, outputDir);
            sse.sendResult({ success: true, release });
        } catch (error) {
            console.error('Immutable deploy error:', error);
            sse.sendError(error.message);
        } finally {
            sse.close();
        }
        return;
    }

    try {
        const tempBuildPath = resolveWithin(config.TEMP_BUILD_DIR, buildId);
        const artifactSource = outputDir ? resolveWithin(tempBuildPath, outputDir, { allowBase: true }) : tempBuildPath;

        if (!fs.existsSync(artifactSource)) {
            throw new Error(`Artifact directory '${outputDir}' not found at ${artifactSource}`);
        }

        let relativeRoot = path.dirname(project.mainFile);
        if (relativeRoot === '.') relativeRoot = project.mainFile;
        const projectRootPath = resolveWithin(config.UPLOADS_DIR, relativeRoot);

        // 创建临时文件清理器
        const cleaner = createTempFileCleaner([tempBuildPath]);

        // 1. Reset Source Directory: Ensure IDE and build are perfectly synced with latest upload
        const sourceDir = resolveWithin(projectRootPath, 'source');
        if (fs.existsSync(sourceDir)) {
            sse.sendLog("🧹 Clearing old source code...");
            fs.rmSync(sourceDir, { recursive: true, force: true });
        }
        fs.mkdirSync(sourceDir, { recursive: true });

        // Copy new source from temp build
        sse.sendLog("🚚 Syncing new source code to project...");
        fs.cpSync(tempBuildPath, sourceDir, { recursive: true });

        // 2. Reset Dist Directory: Ensure a clean deployment environment
        const distDir = resolveWithin(projectRootPath, 'dist');
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
}));

// 9. Get Full Project Config (for tests)
router.get('/:id/full-config', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    res.json({
        id: project.id,
        name: project.name,
        type: project.type,
        port: project.port,
        bindings: project.bindings || {},
        envVars: cryptoHelper.maskSecrets(project.envVars || {}),
        buildCommand: project.buildCommand || '',
        outputDir: project.outputDir || '',
        limits: project.limits,
        status: project.status
    });
});

router.get('/:id/releases', (req, res) => {
    const releases = releaseService.list(req.params.id);
    if (!releases) return res.status(404).json({ error: 'Project not found' });
    res.json(releases);
});

router.get('/:id/deployments', (req, res) => {
    if (!projectService.getById(req.params.id)) return res.status(404).json({ error: 'Project not found' });
    res.json(deploymentService.list(req.params.id, req.query.limit));
});

router.get('/:id/deployments/:deploymentId', (req, res) => {
    if (!projectService.getById(req.params.id)) return res.status(404).json({ error: 'Project not found' });
    const deployment = deploymentService.get(req.params.id, req.params.deploymentId);
    if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
    res.json(deployment);
});

router.get('/:id/runtime-logs', (req, res) => {
    if (!projectService.getById(req.params.id)) return res.status(404).json({ error: 'Project not found' });
    res.json(runtimeLogService.list(req.params.id, req.query));
});

router.delete('/:id/runtime-logs', (req, res) => {
    if (!projectService.getById(req.params.id)) return res.status(404).json({ error: 'Project not found' });
    const removed = runtimeLogService.clear(req.params.id);
    auditService.record('project.runtime_logs_clear', 'project', req.params.id, { removed });
    res.json({ success: true, removed });
});

router.get('/:id/metrics', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(runtimeService.getProjectMetrics(project, projectConcurrencyGate.count(project.id)));
});

router.post('/:id/releases/:releaseId/activate', serializeProjectOperation('release-activate', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    try {
        const release = await switchReleaseAndRestart(project, () =>
            releaseService.activate(project.id, req.params.releaseId, 'manual', validationOptions(project))
        );
        if (!release) return res.status(404).json({ error: 'Release not found' });
        auditService.record('project.release_activate', 'project', project.id, { releaseId: release.id });
        res.json({ success: true, release, project: publicProject(projectService.getById(project.id)) });
    } catch (error) {
        res.status(errorStatus(error)).json({ error: `Release activation failed: ${error.message}` });
    }
}));

router.post('/:id/rollback', serializeProjectOperation('rollback', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    try {
        const release = await switchReleaseAndRestart(project, () =>
            releaseService.rollback(project.id, validationOptions(project))
        );
        if (!release) return res.status(409).json({ error: 'No previous release is available' });
        auditService.record('project.rollback', 'project', project.id, { releaseId: release.id });
        res.json({ success: true, release, project: publicProject(projectService.getById(project.id)) });
    } catch (error) {
        res.status(errorStatus(error)).json({ error: `Rollback failed: ${error.message}` });
    }
}));

// 10. Update Project Config (Bindings, Env Vars, Port)
router.patch('/:id', serializeProjectOperation('config-update', async (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { bindings, envVars, limits, compatibilityDate, compatibilityFlags, port, buildCommand, outputDir } = req.body;
    let needsRestart = false;

    const changes = {};
    if (buildCommand !== undefined) {
        if (typeof buildCommand !== 'string' || buildCommand.length > 8192) {
            return res.status(400).json({ error: 'Build command must be a string of at most 8192 characters' });
        }
        changes.buildCommand = buildCommand;
    }
    if (outputDir !== undefined) {
        if (typeof outputDir !== 'string' || outputDir.length > 512) {
            return res.status(400).json({ error: 'Output directory must be a string of at most 512 characters' });
        }
        try {
            if (outputDir) resolveWithin('/workspace', outputDir, { allowBase: true });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
        changes.outputDir = outputDir;
    }
    if (compatibilityDate !== undefined || compatibilityFlags !== undefined) {
        try {
            Object.assign(changes, normalizeProjectCompatibility({
                compatibilityDate: compatibilityDate ?? project.compatibilityDate,
                compatibilityFlags: compatibilityFlags ?? project.compatibilityFlags
            }));
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
        needsRestart = true;
    }
    if (limits !== undefined) {
        try {
            changes.limits = normalizeProjectLimits({ ...project.limits, ...limits });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
        needsRestart = true;
    }

    if (bindings !== undefined) {
        try {
            changes.bindings = projectService.validateBindings(bindings);
        } catch (error) {
            return res.status(error.statusCode || 400).json({ error: error.message });
        }
        needsRestart = true;
    }
    if (envVars !== undefined) {
        try {
            changes.envVars = prepareEnvVars(envVars, project.id, project.envVars || {});
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
        needsRestart = true;
    }
    if (port !== undefined && port !== project.port) {
        const parsedPort = typeof port === 'number' ? port : Number(port);
        if (!Number.isInteger(parsedPort)) return res.status(400).json({ error: 'Port must be an integer' });
        // Check availability
        const check = await projectService.isPortAvailable(parsedPort, project.id);
        if (!check.valid) return res.status(400).json({ error: check.error });
        changes.port = parsedPort;
        needsRestart = true;
    }

    try {
        const result = await applyProjectUpdate(project, changes, {
            projectService,
            runtime,
            needsRestart
        });
        auditService.record('project.update', 'project', project.id, {
            fields: Object.keys(changes),
            restarted: result.restarted
        });
        res.json({ success: true, project: publicProject(result.project) });
    } catch (error) {
        const suffix = error.updateReverted === true
            ? ' Previous configuration was restored.'
            : error.updateReverted === false
                ? ' Runtime rollback also failed and the project was stopped.'
                : '';
        return res.status(errorStatus(error)).json({ error: `Project update failed: ${error.message}.${suffix}` });
    }
}));

module.exports = router;
module.exports.createDeleteProjectHandler = createDeleteProjectHandler;
module.exports.assertCreateArtifactWithinLimits = assertCreateArtifactWithinLimits;
module.exports.assertProjectCodeUploadLimit = (project, code) => assertWithinByteLimit(
    Buffer.byteLength(code, 'utf8'),
    project.limits.uploadMb * 1024 * 1024,
    `Uploaded code exceeds upload limit (${project.limits.uploadMb} MB)`
);
module.exports.resolveInstallCommand = resolveInstallCommand;
module.exports.cleanupInitialProjectFiles = cleanupInitialProjectFiles;
module.exports.serializeProjectOperation = serializeProjectOperation;
