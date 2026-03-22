const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

// 允许的文件扩展名白名单
const ALLOWED_EXTENSIONS = [
    // 代码文件
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte',
    // 配置文件
    '.json', '.toml', '.yaml', '.yml', '.xml',
    // 样式文件
    '.css', '.scss', '.sass', '.less', '.styl',
    // 模板文件
    '.html', '.htm', '.ejs', '.hbs', '.pug', '.md',
    // 压缩文件
    '.zip', '.tar', '.gz', '.tgz',
    // WebAssembly
    '.wasm',
    // 数据文件
    '.csv', '.txt', '.env',
    // 图片文件（用于静态资源）
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    // 字体文件
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    // 其他
    '.map', '.lock'
];

// MIME 类型白名单
const ALLOWED_MIME_TYPES = [
    // JavaScript/TypeScript
    'application/javascript', 'text/javascript', 'application/x-javascript',
    'text/typescript', 'application/typescript',
    // JSON
    'application/json', 'text/json',
    // HTML/CSS
    'text/html', 'text/css', 'text/x-css',
    // 压缩文件
    'application/zip', 'application/x-zip-compressed', 'application/zip-compressed',
    'application/x-tar', 'application/gzip', 'application/x-gzip',
    // 文本
    'text/plain', 'text/markdown', 'text/csv',
    // 图片
    'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp', 'image/x-icon',
    // 字体
    'font/woff', 'font/woff2', 'application/font-woff', 'application/font-woff2',
    'font/ttf', 'application/x-font-ttf',
    // WebAssembly
    'application/wasm',
    // 其他
    'application/xml', 'text/xml', 'application/yaml', 'text/yaml',
    'application/octet-stream' // 通用二进制，用于某些未知类型
];

// 文件大小限制（字节）
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * 文件过滤器
 */
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    // 检查扩展名
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`不支持的文件类型: ${ext}`), false);
    }

    // 检查 MIME 类型（允许某些未知类型通过 application/octet-stream）
    const isAllowedMime = ALLOWED_MIME_TYPES.some(allowed => 
        mimeType === allowed || mimeType.startsWith('text/') || mimeType.startsWith('application/')
    );

    if (!isAllowedMime) {
        return cb(new Error(`不支持的 MIME 类型: ${mimeType}`), false);
    }

    cb(null, true);
};

/**
 * 生成安全的文件名
 */
const generateSafeFilename = (fieldname, originalname) => {
    const ext = path.extname(originalname).toLowerCase();
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(8).toString('hex');
    return `${fieldname}-${timestamp}-${randomBytes}${ext}`;
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, config.UPLOADS_DIR)
    },
    filename: function (req, file, cb) {
        cb(null, generateSafeFilename(file.fieldname, file.originalname))
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10, // 最多 10 个文件
        fields: 50, // 最多 50 个表单字段
        fieldSize: 1024 * 1024, // 每个字段最大 1MB
        parts: 100 // 最多 100 个 parts
    },
    fileFilter: fileFilter
});

// 错误处理中间件
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: '文件数量超过限制（最多 10 个文件）'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                error: '意外的文件字段'
            });
        }
        return res.status(400).json({ error: `上传错误: ${err.message}` });
    }

    if (err) {
        return res.status(400).json({ error: err.message });
    }

    next();
};

module.exports = upload;
module.exports.handleUploadError = handleUploadError;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
module.exports.ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS;