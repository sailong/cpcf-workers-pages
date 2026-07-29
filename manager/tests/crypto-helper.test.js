'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createCryptoHelper } = require('../utils/crypto-helper');

function legacyEncrypt(value, projectId) {
    const key = crypto.scryptSync(projectId, 'cloudflare-secret-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    return `${iv.toString('hex')}:${cipher.update(value, 'utf8', 'hex') + cipher.final('hex')}`;
}

test('AES-256-GCM secrets round-trip, bind to a project, and reject tampering', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ccfwp-crypto-test-'));
    try {
        const helper = createCryptoHelper({ masterKeyFile: path.join(directory, 'master.key') });
        await helper.initialize();
        const ciphertext = helper.encryptSecret('top-secret', 'project-a');

        assert.match(ciphertext, /^v2:/);
        assert.equal(helper.decryptSecret(ciphertext, 'project-a'), 'top-secret');
        assert.throws(() => helper.decryptSecret(ciphertext, 'project-b'), /authenticate/i);
        const parts = ciphertext.split(':');
        parts[3] = `${parts[3][0] === 'A' ? 'B' : 'A'}${parts[3].slice(1)}`;
        const tampered = parts.join(':');
        assert.throws(() => helper.decryptSecret(tampered, 'project-a'), /authenticate/i);
        assert.equal((await fs.promises.stat(path.join(directory, 'master.key'))).mode & 0o777, 0o600);
    } finally {
        await fs.promises.rm(directory, { recursive: true, force: true });
    }
});

test('legacy AES-CBC ciphertext migrates to authenticated v2 payload on read', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ccfwp-crypto-test-'));
    try {
        const helper = createCryptoHelper({ masterKeyFile: path.join(directory, 'master.key') });
        await helper.initialize();
        const migrated = helper.decryptSecretWithMigration(legacyEncrypt('legacy-value', 'project-a'), 'project-a');

        assert.equal(migrated.value, 'legacy-value');
        assert.equal(migrated.migrated, true);
        assert.match(migrated.ciphertext, /^v2:/);
        assert.equal(helper.decryptSecret(migrated.ciphertext, 'project-a'), 'legacy-value');

        const plaintext = helper.migrateStoredSecret('https://service:8443/token', 'project-a');
        assert.equal(plaintext.value, 'https://service:8443/token');
        assert.equal(plaintext.migrated, true);
        assert.equal(helper.decryptSecret(plaintext.ciphertext, 'project-a'), plaintext.value);
    } finally {
        await fs.promises.rm(directory, { recursive: true, force: true });
    }
});
