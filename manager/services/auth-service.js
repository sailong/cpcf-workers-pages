'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const config = require('../config');

const DEFAULT_PASSWORD = 'Admin@123';
const BCRYPT_ROUNDS = 10;
const PASSWORD_RULES = Object.freeze({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: false
});

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function validatePasswordStrength(password) {
    const errors = [];
    if (!password || typeof password !== 'string') {
        return { valid: false, errors: ['密码不能为空'] };
    }
    if (password.length < PASSWORD_RULES.minLength) errors.push(`密码长度至少 ${PASSWORD_RULES.minLength} 位`);
    if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) errors.push('密码必须包含至少一个大写字母');
    if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) errors.push('密码必须包含至少一个小写字母');
    if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) errors.push('密码必须包含至少一个数字');
    if (PASSWORD_RULES.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('密码必须包含至少一个特殊字符');
    if (['password', '123456', 'admin', 'qwerty', 'letmein'].includes(password.toLowerCase())) {
        errors.push('密码过于简单，请使用更强的密码');
    }
    return { valid: errors.length === 0, errors };
}

function createAuthService(options = {}) {
    const authFile = options.authFile || config.AUTH_FILE;
    const now = options.now || Date.now;
    const sessionTtlMs = options.sessionTtlMs || 12 * 60 * 60 * 1000;
    const captchaTtlMs = options.captchaTtlMs || 5 * 60 * 1000;
    const maxCaptchaChallenges = options.maxCaptchaChallenges || 1000;
    const maxSessions = options.maxSessions || 20;
    const configuredPassword = options.initialPassword === undefined ? process.env.AUTH_PASSWORD : options.initialPassword;

    let passwordHash = null;
    let defaultPassword = !configuredPassword;
    let sessionVersion = 1;
    let initialized = false;
    let saveQueue = Promise.resolve();
    const sessions = new Map();
    const captchaChallenges = new Map();

    function cleanupExpired() {
        const timestamp = now();
        for (const [key, session] of sessions) {
            if (session.expiresAt <= timestamp || session.version !== sessionVersion) sessions.delete(key);
        }
        for (const [key, challenge] of captchaChallenges) {
            if (challenge.expiresAt <= timestamp) captchaChallenges.delete(key);
        }
    }

    function serialize() {
        cleanupExpired();
        return {
            password: passwordHash,
            isDefaultPassword: defaultPassword,
            sessionVersion,
            sessions: Array.from(sessions.entries()).map(([tokenHash, session]) => ({
                tokenHash,
                expiresAt: session.expiresAt,
                version: session.version
            }))
        };
    }

    function save() {
        saveQueue = saveQueue.then(async () => {
            const directory = path.dirname(authFile);
            await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
            const tempFile = `${authFile}.${crypto.randomBytes(8).toString('hex')}.tmp`;
            await fs.promises.writeFile(tempFile, JSON.stringify(serialize(), null, 2), { mode: 0o600 });
            await fs.promises.chmod(tempFile, 0o600);
            await fs.promises.rename(tempFile, authFile);
            await fs.promises.chmod(authFile, 0o600);
        });
        return saveQueue;
    }

    async function initialize() {
        if (initialized) return;

        try {
            const stored = JSON.parse(await fs.promises.readFile(authFile, 'utf8'));
            if (stored.password) {
                if (stored.password.startsWith('$2b$') || stored.password.startsWith('$2a$')) {
                    passwordHash = stored.password;
                } else {
                    passwordHash = await bcrypt.hash(stored.password, BCRYPT_ROUNDS);
                }
            }
            if (typeof stored.isDefaultPassword === 'boolean') defaultPassword = stored.isDefaultPassword;
            if (Number.isSafeInteger(stored.sessionVersion) && stored.sessionVersion > 0) {
                sessionVersion = stored.sessionVersion;
            }
            if (Array.isArray(stored.sessions)) {
                for (const session of stored.sessions) {
                    if (/^[a-f0-9]{64}$/.test(session.tokenHash || '') && session.expiresAt > now() && session.version === sessionVersion) {
                        sessions.set(session.tokenHash, { expiresAt: session.expiresAt, version: session.version });
                    }
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        if (!passwordHash) {
            passwordHash = await bcrypt.hash(configuredPassword || DEFAULT_PASSWORD, BCRYPT_ROUNDS);
            defaultPassword = !configuredPassword;
        }
        initialized = true;
        await save();
    }

    function requireInitialized() {
        if (!initialized) throw new Error('Auth service has not been initialized');
    }

    function createCaptchaChallenge(answer) {
        requireInitialized();
        cleanupExpired();
        const id = crypto.randomBytes(24).toString('base64url');
        const normalized = String(answer).trim().toLowerCase();
        if (captchaChallenges.size >= maxCaptchaChallenges) {
            captchaChallenges.delete(captchaChallenges.keys().next().value);
        }
        captchaChallenges.set(id, {
            answerHash: sha256(`${id}\0${normalized}`),
            expiresAt: now() + captchaTtlMs
        });
        return id;
    }

    function consumeCaptchaChallenge(id, answer) {
        requireInitialized();
        const challenge = captchaChallenges.get(id);
        captchaChallenges.delete(id);
        if (!challenge || challenge.expiresAt <= now()) return false;
        const actual = Buffer.from(sha256(`${id}\0${String(answer).trim().toLowerCase()}`), 'hex');
        const expected = Buffer.from(challenge.answerHash, 'hex');
        return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    }

    async function createSession() {
        requireInitialized();
        cleanupExpired();
        const token = crypto.randomBytes(32).toString('base64url');
        if (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value);
        sessions.set(sha256(token), { expiresAt: now() + sessionTtlMs, version: sessionVersion });
        await save();
        return token;
    }

    function verifySession(token) {
        requireInitialized();
        if (typeof token !== 'string' || token.length < 32) return null;
        cleanupExpired();
        const session = sessions.get(sha256(token));
        if (!session || session.version !== sessionVersion || session.expiresAt <= now()) return null;
        return { role: 'admin', expiresAt: session.expiresAt, version: session.version };
    }

    async function revokeSession(token) {
        if (typeof token === 'string') sessions.delete(sha256(token));
        await save();
    }

    async function setPassword(password) {
        requireInitialized();
        passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        defaultPassword = false;
        sessionVersion += 1;
        sessions.clear();
        await save();
    }

    return {
        PASSWORD_RULES,
        initialize,
        isInitialized: () => initialized,
        isDefaultPassword: () => defaultPassword,
        validatePasswordStrength,
        verifyPassword: async password => Boolean(passwordHash) && bcrypt.compare(password, passwordHash),
        setPassword,
        createCaptchaChallenge,
        consumeCaptchaChallenge,
        createSession,
        verifySession,
        revokeSession,
        getSessionVersion: () => sessionVersion,
        getPersistedSessionsForTest: () => Array.from(sessions.keys())
    };
}

const authService = createAuthService();
authService.createAuthService = createAuthService;

module.exports = authService;
