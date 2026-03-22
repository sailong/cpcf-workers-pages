'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');
const projectService = require('../services/project-service');

/**
 * 安全验证路径，防止目录遍历攻击
 * @param {string} filePathParam - 用户提供的文件路径
 * @param {string} allowedRoot - 允许的根目录
 * @returns {{ valid: boolean, error?: string, resolvedPath?: string }}
 */
function validatePath(filePathParam, allowedRoot) {
    if (!filePathParam || typeof filePathParam !== 'string') {
        return { valid: false, error: '文件路径不能为空' };
    }

    // 1. URL 解码（处理编码绕过）
    let decodedPath;
    try {
        // 多次解码以防止双重编码攻击
        decodedPath = filePathParam;
        let prev = '';
        while (prev !== decodedPath) {
            prev = decodedPath;
            decodedPath = decodeURIComponent(decodedPath);
        }
    } catch (e) {
        return { valid: false, error: '无效的文件路径编码' };
    }

    // 2. 检查危险模式
    const dangerousPatterns = [
        '..',
        '\x00',           // Null 字节
        '\n', '\r',       // 换行符
        // Windows 特殊设备
        /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
    ];

    for (const pattern of dangerousPatterns) {
        if (typeof pattern === 'string' && decodedPath.includes(pattern)) {
            return { valid: false, error: '路径包含不允许的字符' };
        }
        if (pattern instanceof RegExp && pattern.test(decodedPath)) {
            return { valid: false, error: '无效的文件名' };
        }
    }

    // 3. 规范化路径
    const normalizedPath = path.normalize(decodedPath);
    
    // 4. 解析绝对路径
    const resolvedRoot = path.resolve(allowedRoot);
    const resolvedPath = path.resolve(allowedRoot, normalizedPath);

    // 5. 验证最终路径在允许的根目录内
    if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
        return { valid: false, error: '路径超出允许范围' };
    }

    return { valid: true, resolvedPath };
}

/**
 * 获取项目的根目录路径
 * @param {Object} project - 项目对象
 * @returns {string} - 项目根目录路径
 */
function getProjectRootPath(project) {
    const projectRoot = path.join(
        config.UPLOADS_DIR, 
        path.dirname(project.mainFile) === '.' ? project.mainFile : path.dirname(project.mainFile)
    );
    const sourceDir = path.join(projectRoot, 'source');
    
    if (fs.existsSync(sourceDir) && fs.statSync(sourceDir).isDirectory()) {
        return sourceDir;
    }
    
    if (fs.existsSync(projectRoot) && fs.statSync(projectRoot).isDirectory()) {
        return projectRoot;
    }
    
    // 单文件项目
    const mainFilePath = path.join(config.UPLOADS_DIR, project.mainFile);
    if (fs.existsSync(mainFilePath)) {
        return path.dirname(mainFilePath);
    }
    
    return projectRoot;
}

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