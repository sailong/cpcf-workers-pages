const crypto = require('crypto');

/**
 * 环境变量加密/解密工具
 * 使用 AES-256-CBC 算法
 */

const ALGORITHM = 'aes-256-cbc';
const SALT = 'cloudflare-secret-salt';

/**
 * 加密环境变量值
 * @param {string} plainText - 明文
 * @param {string} projectId - 项目 ID（用作密钥的一部分）
 * @returns {string} 加密后的值（格式: iv:encrypted）
 */
function encryptSecret(plainText, projectId) {
    try {
        const key = crypto.scryptSync(projectId, SALT, 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt secret');
    }
}

/**
 * 解密环境变量值
 * @param {string} encryptedText - 加密的值（格式: iv:encrypted）
 * @param {string} projectId - 项目 ID
 * @returns {string} 明文
 */
function decryptSecret(encryptedText, projectId) {
    try {
        const key = crypto.scryptSync(projectId, SALT, 32);
        const parts = encryptedText.split(':');

        if (parts.length !== 2) {
            throw new Error('Invalid encrypted format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encText = parts[1];

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt secret');
    }
}

/**
 * 掩码加密变量（用于前端显示）
 * @param {Object} envVars - 环境变量对象
 * @returns {Object} 掩码后的环境变量
 */
function maskSecrets(envVars) {
    if (!envVars) return {};

    const masked = {};
    for (const [key, varData] of Object.entries(envVars)) {
        if (varData.type === 'secret') {
            masked[key] = { ...varData, value: '******' };
        } else {
            masked[key] = varData;
        }
    }
    return masked;
}

/**
 * 验证环境变量格式
 * @param {string} key - 变量名
 * @param {any} value - 变量值
 * @param {string} type - 变量类型
 * @returns {{valid: boolean, error?: string}}
 */
function validateEnvVar(key, value, type) {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: '变量名不能为空' };
    }

    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        return { valid: false, error: '变量名只能包含大写字母、数字和下划线，且必须以字母或下划线开头' };
    }

    switch (type) {
        case 'plain':
            if (typeof value !== 'string') {
                return { valid: false, error: '明文变量值必须是字符串' };
            }
            break;

        case 'json':
            try {
                if (typeof value === 'string') {
                    JSON.parse(value);
                } else if (typeof value !== 'object') {
                    return { valid: false, error: 'JSON 变量值必须是对象或有效的 JSON 字符串' };
                }
            } catch (e) {
                return { valid: false, error: 'JSON 格式无效: ' + e.message };
            }
            break;

        case 'secret':
            if (typeof value !== 'string') {
                return { valid: false, error: '加密变量值必须是字符串' };
            }
            break;

        default:
            return { valid: false, error: '未知的变量类型: ' + type };
    }

    return { valid: true };
}

module.exports = {
    encryptSecret,
    decryptSecret,
    maskSecrets,
    validateEnvVar
};
