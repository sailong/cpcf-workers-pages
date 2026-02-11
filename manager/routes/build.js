const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const upload = require('../middleware/upload');
const config = require('../config');

router.post('/', (req, res, next) => {
    // Debug log
    next();
}, upload.single('file'), async (req, res) => {
    // Set headers for SSE/streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    const sendLog = (data) => {
        res.write(`data: ${JSON.stringify({ type: 'log', content: data })}\n\n`);
        if (res.flush) res.flush();
    };
    const sendError = (msg) => {
        res.write(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`);
    };
    const sendResult = (result) => res.write(`data: ${JSON.stringify({ type: 'result', ...result })}\n\n`);

    if (!req.file) {
        sendError("No file uploaded");
        return res.end();
    }

    const { buildCommand, outputDir } = req.body;
    const buildId = 'build-' + Date.now();
    const workDir = path.join(config.TEMP_BUILD_DIR, buildId);

    try {
        // 1. Extract
        sendLog(`Extracting files to ${workDir}...`);
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(req.file.path);
        zip.extractAllTo(workDir, true);
        fs.unlinkSync(req.file.path);
        sendLog("Extraction complete.");

        // 2. Build
        if (buildCommand) {
            sendLog(`Executing build command: ${buildCommand}`);

            if ((buildCommand.includes('npm') || buildCommand.includes('yarn') || buildCommand.includes('pnpm')) && !fs.existsSync(path.join(workDir, 'package.json'))) {
                sendLog("Warning: package.json not found, but build command looks like a node script.");
            }

            const child = spawn(buildCommand, {
                cwd: workDir,
                shell: true,
                env: { ...process.env, CI: 'true' }
            });

            child.stdout.on('data', d => sendLog(d.toString()));
            child.stderr.on('data', d => sendLog(d.toString()));

            await new Promise((resolve, reject) => {
                child.on('close', code => {
                    if (code === 0) resolve();
                    else reject(new Error(`Build failed with code ${code}`));
                });
                child.on('error', err => reject(err));
            });

            sendLog("Build command finished successfully.");
        } else {
            sendLog("No build command provided, skipping build step.");
        }

        // 3. Verify Output
        const finalOutputDir = outputDir ? path.join(workDir, outputDir) : workDir;
        if (!fs.existsSync(finalOutputDir)) {
            throw new Error(`Output directory '${outputDir}' not found after build.`);
        }

        // 4. Success
        sendResult({ success: true, buildId });
        res.end();

    } catch (e) {
        sendError(e.message);
        res.end();
    }
});

module.exports = router;
