const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const config = require('../config');
const { validateCommand, safeShellExec } = require('../utils/safe-exec');
const { createSSEManager, createTempFileCleaner } = require('../utils/sse-helper');

router.post('/', (req, res, next) => {
    next();
}, upload.single('file'), async (req, res) => {
    // 创建 SSE 管理器（带超时和心跳）
    const sse = createSSEManager(res, {
        timeout: 30 * 60 * 1000, // 30 分钟超时
        heartbeatInterval: 30 * 1000, // 30 秒心跳
        onClose: () => {
            console.log('[Build] SSE connection closed');
        }
    });

    if (!req.file) {
        sse.sendError("No file uploaded");
        sse.close();
        return;
    }

    const { buildCommand, outputDir } = req.body;
    const buildId = 'build-' + Date.now();
    const workDir = path.join(config.TEMP_BUILD_DIR, buildId);

    // 创建临时文件清理器
    const cleaner = createTempFileCleaner([req.file.path, workDir]);

    try {
        // 1. Extract
        sse.sendLog(`Extracting files to ${workDir}...`);
        const AdmZip = require('adm-zip');
        const { flattenDirectory } = require('../utils/fs-helper');
        const zip = new AdmZip(req.file.path);
        zip.extractAllTo(workDir, true);

        // 清理上传的临时文件
        try { fs.unlinkSync(req.file.path); } catch { }

        // Normalize: handle nested folder in ZIP
        flattenDirectory(workDir);

        sse.sendLog("Extraction complete and directory normalized.");

        // 2. Build
        if (buildCommand) {
            // 安全验证命令
            const validation = validateCommand(buildCommand);
            if (!validation.valid) {
                sse.sendError(`不安全的构建命令被拒绝: ${validation.error}`);
                await cleaner.cleanup();
                sse.close();
                return;
            }

            sse.sendLog(`Executing build command: ${buildCommand}`);

            if ((buildCommand.includes('npm') || buildCommand.includes('yarn') || buildCommand.includes('pnpm')) && !fs.existsSync(path.join(workDir, 'package.json'))) {
                sse.sendLog("Warning: package.json not found, but build command looks like a node script.");
            }

            try {
                await safeShellExec(buildCommand, { cwd: workDir, timeout: 600000 },
                    (out) => sse.sendLog(out),
                    (err) => sse.sendLog(err)
                );
                sse.sendLog("Build command finished successfully.");
            } catch (e) {
                sse.sendError(`Build failed: ${e.message}`);
                // 构建失败时保留工作目录以便调试
                cleaner.removeHandler();
                sse.close();
                return;
            }
        } else {
            sse.sendLog("No build command provided, skipping build step.");
        }

        // 3. Verify Output
        const finalOutputDir = outputDir ? path.join(workDir, outputDir) : workDir;
        if (!fs.existsSync(finalOutputDir)) {
            throw new Error(`Output directory '${outputDir}' not found after build.`);
        }

        // 4. Success - 移除清理器（工作目录需要保留供后续部署使用）
        cleaner.removeHandler();
        sse.sendResult({ success: true, buildId });
        sse.close();

    } catch (e) {
        sse.sendError(e.message);
        await cleaner.cleanup();
        sse.close();
    }
});

module.exports = router;