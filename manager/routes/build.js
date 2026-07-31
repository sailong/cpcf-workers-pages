const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const runtimeService = require('../services/runtime-service');
const buildArtifacts = require('../services/build-artifact-service');
const { DEFAULT_PROJECT_LIMITS, normalizeProjectLimits } = require('../services/project-limits');
const { createSSEManager, createTempFileCleaner } = require('../utils/sse-helper');
const { resolveWithin } = require('../utils/path-helper');
const { extractZipSafely } = require('../utils/zip-helper');
const { assertPathWithinByteLimit } = require('../utils/fs-helper');
const { createAbortError, throwIfAborted } = require('../utils/abort');

router.post('/', (req, res, next) => {
    next();
}, upload.singleForProject('file'), async (req, res) => {
    const abortController = new AbortController();
    // 创建 SSE 管理器（带超时和心跳）
    const sse = createSSEManager(res, {
        timeout: 30 * 60 * 1000, // 30 分钟超时
        heartbeatInterval: 30 * 1000, // 30 秒心跳
        onClose: () => {
            abortController.abort();
            console.log('[Build] SSE connection closed');
        }
    });

    if (!req.file) {
        sse.sendError("No file uploaded");
        sse.close();
        return;
    }

    const { buildCommand, outputDir } = req.body;
    let buildLimits = req.uploadProject?.limits || DEFAULT_PROJECT_LIMITS;
    if (!req.uploadProject && req.body.limits) {
        try {
            const requested = typeof req.body.limits === 'string' ? JSON.parse(req.body.limits) : req.body.limits;
            buildLimits = normalizeProjectLimits(requested);
        } catch (error) {
            sse.sendError(`Invalid project limits: ${error.message}`);
            sse.close();
            if (req.file) fs.rmSync(req.file.path, { force: true });
            return;
        }
    }
    const buildTimeoutMs = buildLimits.buildTimeoutSeconds * 1000;
    const buildId = `build-${crypto.randomUUID()}`;
    buildArtifacts.cleanupExpired();
    const workDir = buildArtifacts.begin(buildId);

    // 创建临时文件清理器
    const cleaner = createTempFileCleaner([req.file.path, workDir]);
    let retainArtifact = false;

    try {
        // 1. Extract
        sse.sendLog(`Extracting files to ${workDir}...`);
        const { flattenDirectory } = require('../utils/fs-helper');
        const maxExpandedBytes = buildLimits.diskMb * 1024 * 1024;
        await extractZipSafely(req.file.path, workDir, { maxExpandedBytes });
        throwIfAborted(abortController.signal);

        // 清理上传的临时文件
        try { fs.unlinkSync(req.file.path); } catch { }

        // Normalize: handle nested folder in ZIP
        flattenDirectory(workDir);

        sse.sendLog("Extraction complete and directory normalized.");

        // 2. Build
        if (buildCommand) {
            sse.sendLog(`Executing build command: ${buildCommand}`);

            if ((/\b(npm|yarn|pnpm)\b/.test(buildCommand)) && !fs.existsSync(path.join(workDir, 'package.json'))) {
                throw new Error('package.json is required before running npm/yarn/pnpm build commands');
            }

            try {
                const buildProject = req.uploadProject || {
                    id: buildId,
                    limits: buildLimits
                };
                await runtimeService.runtime.runBuild(buildProject, buildCommand, {
                    cwd: workDir,
                    timeout: buildTimeoutMs,
                    signal: abortController.signal,
                    onStdout: out => sse.sendLog(out),
                    onStderr: err => sse.sendLog(err)
                });
                sse.sendLog("Build command finished successfully.");
            } catch (e) {
                throw new Error(`Build failed: ${e.message}`);
            }
        } else {
            sse.sendLog("No build command provided, skipping build step.");
        }

        // 3. Verify Output
        const finalOutputDir = outputDir ? resolveWithin(workDir, outputDir, { allowBase: true }) : workDir;
        if (!fs.existsSync(finalOutputDir)) {
            throw new Error(`Output directory '${outputDir}' not found after build.`);
        }

        assertPathWithinByteLimit(
            workDir,
            maxExpandedBytes,
            `Build workspace exceeds disk limit (${Math.floor(maxExpandedBytes / 1024 / 1024)} MB)`
        );

        throwIfAborted(abortController.signal);
        // 4. Success - 工作目录短期保留供后续部署使用
        cleaner.removeHandler();
        if (!sse.sendResult({ success: true, buildId })) throw createAbortError();
        buildArtifacts.retain(buildId);
        retainArtifact = true;

    } catch (e) {
        sse.sendError(e.message);
    } finally {
        if (!retainArtifact) {
            await cleaner.cleanup();
            buildArtifacts.discard(buildId);
        }
        sse.close();
    }
});

module.exports = router;
