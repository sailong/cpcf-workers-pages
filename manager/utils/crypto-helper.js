'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const VERSION = 'v2';
const LEGACY_ALGORITHM = 'aes-256-cbc';
const LEGACY_SALT = 'cloudflare-secret-salt';

function createCryptoHelper(options = {}) {
    const masterKeyFile = options.masterKeyFile || path.join(config.DATA_DIR, 'master.key');
    let masterKey = null;

    async function initialize() {
        if (masterKey) return;
        await fs.promises.mkdir(path.dirname(masterKeyFile), { recursive: true, mode: 0o700 });

        try {
            const handle = await fs.promises.open(masterKeyFile, 'wx', 0o600);
            try {
                await handle.writeFile(crypto.randomBytes(32));
            } finally {
                await handle.close();
            }
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }

        const stored = await fs.promises.readFile(masterKeyFile);
        if (stored.length !== 32) throw new Error('Master key must contain exactly 32 bytes');
        await fs.promises.chmod(masterKeyFile, 0o600);
        masterKey = Buffer.from(stored);
    }

    function requireKey() {
        if (!masterKey) throw new Error('Crypto helper has not been initialized');
        return masterKey;
    }

    function aad(projectId) {
        return Buffer.from(`ccfwp-secret\0${projectId || ''}`, 'utf8');
    }

    function encryptSecret(plainText, projectId) {
        if (typeof plainText !== 'string') throw new TypeError('Secret value must be a string');
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', requireKey(), iv);
        cipher.setAAD(aad(projectId));
        const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
    }

    function decryptV2(encryptedText, projectId) {
        const parts = encryptedText.split(':');
        if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('Invalid encrypted secret format');
        const iv = Buffer.from(parts[1], 'base64url');
        const tag = Buffer.from(parts[2], 'base64url');
        const encrypted = Buffer.from(parts[3], 'base64url');
        if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid encrypted secret parameters');

        const decipher = crypto.createDecipheriv('aes-256-gcm', requireKey(), iv);
        decipher.setAAD(aad(projectId));
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    }

    function decryptLegacy(encryptedText, projectId) {
        const parts = encryptedText.split(':');
        if (parts.length !== 2 || !/^[a-f0-9]{32}$/i.test(parts[0]) || !/^[a-f0-9]+$/i.test(parts[1])) {
            throw new Error('Invalid legacy encrypted secret format');
        }
        const key = crypto.scryptSync(projectId, LEGACY_SALT, 32);
        const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, Buffer.from(parts[0], 'hex'));
        return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
    }

    function decryptSecretWithMigration(encryptedText, projectId) {
        try {
            if (encryptedText.startsWith(`${VERSION}:`)) {
                return { value: decryptV2(encryptedText, projectId), ciphertext: encryptedText, migrated: false };
            }
            const value = decryptLegacy(encryptedText, projectId);
            return { value, ciphertext: encryptSecret(value, projectId), migrated: true };
        } catch {
            throw new Error('Failed to authenticate encrypted secret');
        }
    }

    function decryptSecret(encryptedText, projectId) {
        return decryptSecretWithMigration(encryptedText, projectId).value;
    }

    function migrateStoredSecret(storedValue, projectId) {
        if (storedValue.startsWith(`${VERSION}:`)) return decryptSecretWithMigration(storedValue, projectId);
        if (/^[a-f0-9]{32}:[a-f0-9]+$/i.test(storedValue)) {
            return decryptSecretWithMigration(storedValue, projectId);
        }
        return { value: storedValue, ciphertext: encryptSecret(storedValue, projectId), migrated: true };
    }

    function maskSecrets(envVars) {
        if (!envVars) return {};
        return Object.fromEntries(Object.entries(envVars).map(([key, varData]) => [
            key,
            varData.type === 'secret' ? { ...varData, value: '******' } : varData
        ]));
    }

    function validateEnvVar(key, value, type) {
        if (!key || typeof key !== 'string') return { valid: false, error: '变量名不能为空' };
        if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
            return { valid: false, error: '变量名只能包含大写字母、数字和下划线，且必须以字母或下划线开头' };
        }
        if (type === 'plain' || type === 'secret') {
            return typeof value === 'string' ? { valid: true } : { valid: false, error: '变量值必须是字符串' };
        }
        if (type === 'json') {
            try {
                if (typeof value === 'string') JSON.parse(value);
                else if (!value || typeof value !== 'object') throw new Error('not an object');
                return { valid: true };
            } catch {
                return { valid: false, error: 'JSON 格式无效' };
            }
        }
        return { valid: false, error: `未知的变量类型: ${type}` };
    }

    return {
        initialize,
        encryptSecret,
        decryptSecret,
        decryptSecretWithMigration,
        migrateStoredSecret,
        maskSecrets,
        validateEnvVar,
        getMasterKeyFile: () => masterKeyFile
    };
}

const cryptoHelper = createCryptoHelper();
cryptoHelper.createCryptoHelper = createCryptoHelper;

module.exports = cryptoHelper;
