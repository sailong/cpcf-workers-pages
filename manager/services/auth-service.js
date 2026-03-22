const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUTH_FILE = path.join(__dirname, '../../.platform-data/auth.json');

// 默认密码（首次启动时使用）
const DEFAULT_PASSWORD = 'Admin@123';

// 密码复杂度验证规则
const PASSWORD_RULES = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: false
};

let runtimePassword = process.env.AUTH_PASSWORD || DEFAULT_PASSWORD;
let JWT_SECRET = process.env.JWT_SECRET || null;
let isDefaultPassword = !process.env.AUTH_PASSWORD; // 标记是否使用默认密码

/**
 * 使用密码学安全的随机数生成 JWT 密钥
 * @returns {string} 64 字节的十六进制字符串
 */
function generateSecureSecret() {
    return crypto.randomBytes(64).toString('hex');
}

/**
 * 验证密码复杂度
 * @param {string} password - 要验证的密码
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePasswordStrength(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
        return { valid: false, errors: ['密码不能为空'] };
    }

    if (password.length < PASSWORD_RULES.minLength) {
        errors.push(`密码长度至少 ${PASSWORD_RULES.minLength} 位`);
    }

    if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('密码必须包含至少一个大写字母');
    }

    if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('密码必须包含至少一个小写字母');
    }

    if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
        errors.push('密码必须包含至少一个数字');
    }

    if (PASSWORD_RULES.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('密码必须包含至少一个特殊字符');
    }

    // 检查常见弱密码
    const weakPasswords = ['password', '123456', 'admin', 'qwerty', 'letmein'];
    if (weakPasswords.includes(password.toLowerCase())) {
        errors.push('密码过于简单，请使用更强的密码');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function load() {
    if (fs.existsSync(AUTH_FILE)) {
        try {
            const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
            if (authData.password) {
                runtimePassword = authData.password;
                isDefaultPassword = false;
            }
            if (authData.jwtSecret) JWT_SECRET = authData.jwtSecret;
            if (authData.isDefaultPassword !== undefined) {
                isDefaultPassword = authData.isDefaultPassword;
            }
        } catch (e) { console.error("Failed to load auth file", e); }
    }

    // 使用密码学安全的随机数生成 JWT 密钥
    if (!JWT_SECRET) {
        JWT_SECRET = generateSecureSecret();
        save();
        console.log('Generated and persisted new secure JWT_SECRET');
    }
}

function save() {
    const authData = fs.existsSync(AUTH_FILE)
        ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
        : {};
    authData.password = runtimePassword;
    authData.jwtSecret = JWT_SECRET;
    authData.isDefaultPassword = isDefaultPassword;
    // create dir if not exists
    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
}

// Initial load
load();

module.exports = {
    getPassword: () => runtimePassword,
    setPassword: (pwd) => {
        runtimePassword = pwd;
        isDefaultPassword = false;
        save();
    },
    getJwtSecret: () => JWT_SECRET,
    isDefaultPassword: () => isDefaultPassword,
    markPasswordChanged: () => {
        isDefaultPassword = false;
        save();
    },
    validatePasswordStrength,
    PASSWORD_RULES
};