const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const config = require('../config');
const { resolveWithin } = require('../utils/path-helper');
const { extractZipSafely } = require('../utils/zip-helper');
const { DEFAULT_PROJECT_LIMITS } = require('../services/project-limits');

router.post('/', upload.singleForProject('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = resolveWithin(config.UPLOADS_DIR, req.file.filename);
    const isZip = req.file.originalname.toLowerCase().endsWith('.zip');

    if (isZip) {
        // Extract ZIP for Pages projects
        const extractDir = resolveWithin(config.UPLOADS_DIR, `page-${crypto.randomUUID()}`);

        try {
            await extractZipSafely(filePath, extractDir, {
                maxExpandedBytes: DEFAULT_PROJECT_LIMITS.diskMb * 1024 * 1024
            });

            // Normalize: handle nested folder in ZIP
            const { flattenDirectory } = require('../utils/fs-helper');
            flattenDirectory(extractDir);

            // Delete the ZIP file after extraction
            fs.unlinkSync(filePath);

            // Return the directory name (relative to UPLOADS_DIR)
            res.json({
                filename: path.basename(extractDir),
                originalName: req.file.originalname,
                isDirectory: true
            });
        } catch (e) {
            try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch { }
            try { fs.unlinkSync(filePath); } catch { }
            return res.status(400).json({ error: "Failed to extract ZIP: " + e.message });
        }
    } else {
        // Single file upload (for Workers)
        res.json({ filename: req.file.filename, originalName: req.file.originalname, isDirectory: false });
    }
});

module.exports = router;
