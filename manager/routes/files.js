'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');
const projectService = require('../services/project-service');

// Helper function
function getFiles(dir, baseDir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            // Recurse
            results = results.concat(getFiles(filePath, baseDir));
        } else {
            results.push({
                name: file,
                path: filePath.substring(baseDir.length + 1), // relative path
                size: stat.size
            });
        }
    });
    return results;
}

// 12. List Files
router.get('/:id/files', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const projectDir = path.join(config.UPLOADS_DIR, project.mainFile);
    if (!fs.existsSync(projectDir)) {
        return res.json([]);
    }

    if (!fs.statSync(projectDir).isDirectory()) {
        // Single file project
        return res.json([{
            name: path.basename(project.mainFile),
            path: path.basename(project.mainFile),
            size: fs.statSync(projectDir).size
        }]);
    }

    try {
        const files = getFiles(projectDir, projectDir);
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: "Failed to list files: " + e.message });
    }
});

// 13. Read File Content
router.get('/:id/files/content', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const filePathParam = req.query.path;
    if (!filePathParam) return res.status(400).json({ error: "File path is required" });

    // Prevent directory traversal
    if (filePathParam.includes('..')) return res.status(400).json({ error: "Invalid path" });

    // Determine root
    let rootPath = path.join(config.UPLOADS_DIR, project.mainFile);
    if (fs.existsSync(rootPath) && !fs.statSync(rootPath).isDirectory()) {
        rootPath = path.dirname(rootPath);
    }

    const targetPath = path.join(rootPath, filePathParam);

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
router.put('/:id/files/content', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { path: filePathParam, content } = req.body;
    if (!filePathParam) return res.status(400).json({ error: "File path is required" });
    if (content === undefined) return res.status(400).json({ error: "Content is required" });

    if (filePathParam.includes('..')) return res.status(400).json({ error: "Invalid path" });

    let rootPath = path.join(config.UPLOADS_DIR, project.mainFile);
    if (fs.existsSync(rootPath) && !fs.statSync(rootPath).isDirectory()) {
        rootPath = path.dirname(rootPath);
    }

    const targetPath = path.join(rootPath, filePathParam);

    try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to save file: " + e.message });
    }
});

module.exports = router;
