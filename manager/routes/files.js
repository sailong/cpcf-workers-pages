'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');
const projectService = require('../services/project-service');
const { DEFAULT_PROJECT_LIMITS } = require('../services/project-limits');
const { assertNoSymlinkWithin, resolveWithin } = require('../utils/path-helper');
const { getReleaseRoot, isReleasePath, resolveProjectPath } = require('../utils/project-paths');
const { getDirectorySize } = require('../utils/fs-helper');

const MAX_FILE_CONTENT_BYTES = 10 * 1024 * 1024;

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
    if (isReleasePath(project.mainFile)) {
        const releaseRoot = getReleaseRoot(project.mainFile);
        const sourceDir = resolveWithin(releaseRoot, 'source');
        return fs.existsSync(sourceDir) ? sourceDir : resolveProjectPath(project.mainFile);
    }
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


function assertProjectDiskLimit(project, rootPath, targetPath, nextSize) {
    const limitBytes = project.limits.diskMb * 1024 * 1024;
    const currentSize = getDirectorySize(rootPath);
    const previousSize = targetPath === rootPath ? currentSize : getDirectorySize(targetPath);
    const projectedSize = currentSize - previousSize + nextSize;
    if (projectedSize > limitBytes) {
        const error = new Error(`Project disk limit exceeded (${project.limits.diskMb} MB)`);
        error.statusCode = 413;
        throw error;
    }
}

function getProjectContentLimitBytes(project) {
    const configured = Number(project?.limits?.uploadMb || DEFAULT_PROJECT_LIMITS.uploadMb) * 1024 * 1024;
    return Math.min(MAX_FILE_CONTENT_BYTES, configured);
}

function assertProjectUploadLimit(project, size) {
    const limitBytes = getProjectContentLimitBytes(project);
    if (size > limitBytes) {
        const limitMb = Math.floor(limitBytes / 1024 / 1024);
        const error = new Error(`File content exceeds upload limit (${limitMb} MB)`);
        error.statusCode = 413;
        throw error;
    }
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

    // Keep the editor bounded even when a project has a larger package upload limit.
    const stat = fs.statSync(validation.resolvedPath);
    try {
        assertProjectUploadLimit(project, stat.size);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.message });
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
    if (isReleasePath(project.mainFile)) {
        return res.status(409).json({ error: 'Immutable release files cannot be edited in place; create a new deployment' });
    }

    const { path: filePathParam, content } = req.body;
    if (!filePathParam) return res.status(400).json({ error: "File path is required" });
    if (content === undefined) return res.status(400).json({ error: "Content is required" });

    const contentSize = Buffer.byteLength(content, 'utf8');
    try {
        assertProjectUploadLimit(project, contentSize);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.message });
    }

    // 获取项目根目录
    const rootPath = getProjectRootPath(project);

    // 安全验证路径
    const validation = validatePath(filePathParam, rootPath);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        assertProjectDiskLimit(project, rootPath, validation.resolvedPath, contentSize);
        fs.mkdirSync(path.dirname(validation.resolvedPath), { recursive: true });
        fs.writeFileSync(validation.resolvedPath, content, 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : "Failed to save file: " + e.message });
    }
});

// 15. Delete File
router.delete('/:id/files/content', (req, res) => {
    const project = projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (isReleasePath(project.mainFile)) {
        return res.status(409).json({ error: 'Immutable release files cannot be deleted in place; create a new deployment' });
    }

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
module.exports.assertProjectDiskLimit = assertProjectDiskLimit;
module.exports.assertProjectUploadLimit = assertProjectUploadLimit;
module.exports.getProjectContentLimitBytes = getProjectContentLimitBytes;
