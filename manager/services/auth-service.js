const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const AUTH_FILE = path.join(__dirname, '../../.platform-data/auth.json');
const BCRYPT_ROUNDS = 10;

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

let runtimePasswordHash = null; // 存储哈希而非明文
let JWT_SECRET = process.env.JWT_SECRET || null;
let isDefaultPassword = !process.env.AUTH_PASSWORD;

/**
 * 使用密码学安全的随机数生成 JWT 密钥
 */
function generateSecureSecret() {
    return crypto.randomBytes(64).toString('hex');
}

/**
 * 验证密码复杂度
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

    const weakPasswords = ['password', '123456', 'admin', 'qwerty', 'letmein'];
    if (weakPasswords.includes(password.toLowerCase())) {
        errors.push('密码过于简单，请使用更强的密码');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * 异步哈希密码
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * 异步验证密码
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

async function load() {
    if (fs.existsSync(AUTH_FILE)) {
        try {
            const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
            
            // 迁移逻辑：如果是明文密码，转换为哈希
            if (authData.password) {
                if (authData.password.startsWith('$2b$') || authData.password.startsWith('$2a$')) {
                    // 已经是哈希
                    runtimePasswordHash = authData.password;
                    isDefaultPassword = false;
                } else {
                    // 明文密码，需要哈希化
                    console.log('[Auth] Migrating plaintext password to bcrypt hash...');
                    runtimePasswordHash = await hashPassword(authData.password);
                    isDefaultPassword = false;
                    save(); // 保存哈希
                }
            }
            
            if (authData.jwtSecret) JWT_SECRET = authData.jwtSecret;
            if (authData.isDefaultPassword !== undefined) {
                isDefaultPassword = authData.isDefaultPassword;
            }
        } catch (e) { 
            console.error("Failed to load auth file", e); 
        }
    }

    // 如果没有密码哈希，使用默认密码的哈希
    if (!runtimePasswordHash) {
        console.log('[Auth] Using default password (hashing...)');
        runtimePasswordHash = await hashPassword(DEFAULT_PASSWORD);
        save();
    }

    // 生成 JWT Secret
    if (!JWT_SECRET) {
        JWT_SECRET = generateSecureSecret();
        save();
        console.log('Generated and persisted new secure JWT_SECRET');
    }
}

async function save() {
    const authData = fs.existsSync(AUTH_FILE)
        ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
        : {};
    
    // 只存储哈希，不存储明文
    authData.password = runtimePasswordHash;
    authData.jwtSecret = JWT_SECRET;
    authData.isDefaultPassword = isDefaultPassword;
    
    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
}

// 初始加载
load();

module.exports = {
    getPasswordHash: () => runtimePasswordHash,
    setPassword: async (pwd) => {
        runtimePasswordHash = await hashPassword(pwd);
        isDefaultPassword = false;
        await save();
    },
    verifyPassword: async (password) => {
        if (!runtimePasswordHash) return false;
        return await verifyPassword(password, runtimePasswordHash);
    },
    getJwtSecret: () => JWT_SECRET,
    isDefaultPassword: () => isDefaultPassword,
    markPasswordChanged: async () => {
        isDefaultPassword = false;
        await save();
    },
    validatePasswordStrength,
    PASSWORD_RULES
};
