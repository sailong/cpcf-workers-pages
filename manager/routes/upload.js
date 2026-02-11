const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const config = require('../config');

router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = path.join(config.UPLOADS_DIR, req.file.filename);
    const isZip = req.file.originalname.toLowerCase().endsWith('.zip');

    if (isZip) {
        // Extract ZIP for Pages projects
        const AdmZip = require('adm-zip');
        const extractDir = path.join(config.UPLOADS_DIR, 'page-' + Date.now().toString(36));

        try {
            const zip = new AdmZip(filePath);
            zip.extractAllTo(extractDir, true);

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
            return res.status(500).json({ error: "Failed to extract ZIP: " + e.message });
        }
    } else {
        // Single file upload (for Workers)
        res.json({ filename: req.file.filename, originalName: req.file.originalname, isDirectory: false });
    }
});

module.exports = router;
