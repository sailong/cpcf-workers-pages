'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');
const projectService = require('../services/project-service');
const { assertNoSymlinkWithin, resolveWithin } = require('../utils/path-helper');

/**
 * 安全验证路径，防止目录遍历攻击
 * @param {string} filePathParam - 用户提供的文件路径
 * @param {string} allowedRoot - 允许的根目录
 * @returns {{ valid: boolean, error?: string, resolvedPath?: string }}
 */
function validatePath(filePathParam, allowedRoot) {
    try {
        if (fs.existsSync(allowedRoot) && fs.statSync(allowedRoot).isFile()) {
            const resolvedPath = resolveWithin(path.dirname(allowedRoot), filePathParam);
            if (resolvedPath !== allowedRoot) return { valid: false, error: '路径超出允许范围' };
            assertNoSymlinkWithin(path.dirname(allowedRoot), resolvedPath);
            return { valid: true, resolvedPath };
        }
        const resolvedPath = resolveWithin(allowedRoot, filePathParam);
        assertNoSymlinkWithin(allowedRoot, resolvedPath);
        return { valid: true, resolvedPath };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * 获取项目的根目录路径
 * @param {Object} project - 项目对象
 * @returns {string} - 项目根目录路径
 */
function getProjectRootPath(project) {
    const mainPath = resolveWithin(config.UPLOADS_DIR, project.mainFile);
    const relativeRoot = path.dirname(project.mainFile) === '.' ? project.mainFile : path.dirname(project.mainFile);
    const projectRoot = resolveWithin(config.UPLOADS_DIR, relativeRoot);
    const sourceDir = resolveWithin(projectRoot, 'source');
    
    if (fs.existsSync(sourceDir) && fs.statSync(sourceDir).isDirectory()) {
        return sourceDir;
    }
    
    if (fs.existsSync(projectRoot) && fs.statSync(projectRoot).isDirectory()) {
        return projectRoot;
    }
    
    // 单文件项目
    if (fs.existsSync(mainPath)) return mainPath;
    
    return projectRoot;
}

// Helper function
function getFiles(dir, baseDir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.lstatSync(filePath);
        if (stat.isSymbolicLink()) return;
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

    const projectDir = getProjectRootPath(project);

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

    // 获取项目根目录
    const rootPath = getProjectRootPath(project);

    // 安全验证路径
    const validation = validatePath(filePathParam, rootPath);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    if (!fs.existsSync(validation.resolvedPath)) {
        return res.status(404).json({ error: "File not found" });
    }

    if (fs.statSync(validation.resolvedPath).isDirectory()) {
        return res.status(400).json({ error: "Cannot read directory content" });
    }

    // 文件大小限制（10MB）
    const stat = fs.statSync(validation.resolvedPath);
    if (stat.size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large (max 10MB)" });
    }

    try {
        const content = fs.readFileSync(validation.resolvedPath, 'utf8');
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

    // 内容大小限制（10MB）
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "Content too large (max 10MB)" });
    }

    // 获取项目根目录
    const rootPath = getProjectRootPath(project);

    // 安全验证路径
    const validation = validatePath(filePathParam, rootPath);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        fs.mkdirSync(path.dirname(validation.resolvedPath), { recursive: true });
        fs.writeFileSync(validation.resolvedPath, content, 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to save file: " + e.message });
    }
});

// 15. Delete File
router.delete('/:id/files/content', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const filePathParam = req.query.path;
    if (!filePathParam) return res.status(400).json({ error: "File path is required" });

    // 获取项目根目录
    const rootPath = getProjectRootPath(project);

    // 安全验证路径
    const validation = validatePath(filePathParam, rootPath);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    if (!fs.existsSync(validation.resolvedPath)) {
        return res.status(404).json({ error: "File not found" });
    }

    try {
        if (fs.statSync(validation.resolvedPath).isDirectory()) {
            fs.rmSync(validation.resolvedPath, { recursive: true });
        } else {
            fs.unlinkSync(validation.resolvedPath);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete file: " + e.message });
    }
});

module.exports = router;
