'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { createAuthService } = require('../services/auth-service');
const { createAuthMiddleware } = require('../middleware/auth');
const { createLoginRateLimiter } = require('../middleware/login-rate-limit');
const { createAuthRouter } = require('../routes/auth');
const { assertProductionPasswordConfigured } = require('../server');
const { createDatabase } = require('../services/database');

async function withServer(options, run) {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ccfwp-auth-test-'));
    const authService = createAuthService({
        authFile: path.join(directory, 'auth.json'),
        initialPassword: Object.hasOwn(options, 'initialPassword') ? options.initialPassword : 'StrongPass123'
    });
    await authService.initialize();

    let captchaAnswer = '';
    const createChallenge = authService.createCaptchaChallenge;
    authService.createCaptchaChallenge = answer => {
        captchaAnswer = answer;
        return createChallenge(answer);
    };

    const app = express();
    app.use(express.json({ limit: '16kb', strict: true }));
    app.use(createAuthMiddleware(authService));
    app.use('/api', createAuthRouter({
        authService,
        loginRateLimiter: createLoginRateLimiter(options),
        captchaRateLimiter: options.captchaRateLimiter,
        secureCookies: options.secureCookies
    }));
    app.get('/api/protected', (req, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        await run({ authService, baseUrl, directory, getCaptchaAnswer: () => captchaAnswer });
    } finally {
        await new Promise(resolve => server.close(resolve));
        await fs.promises.rm(directory, { recursive: true, force: true });
    }
}

test('captcha challenge is opaque, server-side, expiring, and one-use', async () => {
    await withServer({}, async ({ authService, baseUrl, directory, getCaptchaAnswer }) => {
        const response = await fetch(`${baseUrl}/api/captcha`);
        const payload = await response.json();
        const answer = getCaptchaAnswer();

        assert.equal(response.status, 200);
        assert.ok(answer);
        assert.ok(!payload.captchaId.toLowerCase().includes(answer.toLowerCase()));
        assert.ok(!JSON.stringify(payload).includes(`"text":"${answer}"`));
        assert.ok(!await fs.promises.readFile(path.join(directory, 'auth.json'), 'utf8').then(text => text.includes(answer)));
        assert.equal(authService.consumeCaptchaChallenge(payload.captchaId, answer), true);
        assert.equal(authService.consumeCaptchaChallenge(payload.captchaId, answer), false);
    });
});

test('login sets a hardened opaque cookie and password change revokes it', async () => {
    await withServer({ secureCookies: true }, async ({ baseUrl, directory, getCaptchaAnswer }) => {
        const captcha = await fetch(`${baseUrl}/api/captcha`).then(response => response.json());
        const login = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'StrongPass123',
                captcha: getCaptchaAnswer(),
                captchaId: captcha.captchaId
            })
        });
        const cookie = login.headers.get('set-cookie');

        assert.equal(login.status, 200);
        assert.match(cookie, /^__Host-ccfwp_session=/);
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /Secure/i);
        assert.match(cookie, /SameSite=Strict/i);
        assert.match(cookie, /Path=\//i);

        const rawToken = cookie.match(/^__Host-ccfwp_session=([^;]+)/)[1];
        const persisted = await fs.promises.readFile(path.join(directory, 'auth.json'), 'utf8');
        assert.ok(!persisted.includes(rawToken));
        assert.equal((await fetch(`${baseUrl}/api/verify-session`, { headers: { Cookie: cookie } })).status, 200);

        const changed = await fetch(`${baseUrl}/api/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ oldPassword: 'StrongPass123', newPassword: 'NewStrongPass456' })
        });
        assert.equal(changed.status, 200);
        assert.equal((await fetch(`${baseUrl}/api/verify-session`, { headers: { Cookie: cookie } })).status, 401);
    });
});

test('development login uses an HTTP-compatible session cookie', async () => {
    await withServer({ secureCookies: false }, async ({ baseUrl, getCaptchaAnswer }) => {
        const captcha = await fetch(`${baseUrl}/api/captcha`).then(response => response.json());
        const login = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'StrongPass123',
                captcha: getCaptchaAnswer(),
                captchaId: captcha.captchaId
            })
        });
        const cookie = login.headers.get('set-cookie');

        assert.equal(login.status, 200);
        assert.match(cookie, /^ccfwp_session=/);
        assert.doesNotMatch(cookie, /Secure/i);
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /SameSite=Strict/i);
        assert.equal((await fetch(`${baseUrl}/api/verify-session`, { headers: { Cookie: cookie } })).status, 200);
    });
});

test('login attempts are bounded per IP', async () => {
    await withServer({ maxAttempts: 1, windowMs: 60000 }, async ({ baseUrl }) => {
        const first = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const second = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert.equal(first.status, 400);
        assert.equal(second.status, 429);
        assert.ok(Number(second.headers.get('retry-after')) > 0);
    });
});

test('successful login resets the per-IP attempt budget', async () => {
    await withServer({ maxAttempts: 1, windowMs: 60000 }, async ({ baseUrl, getCaptchaAnswer }) => {
        const login = async () => {
            const captcha = await fetch(`${baseUrl}/api/captcha`).then(response => response.json());
            return fetch(`${baseUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'StrongPass123',
                    captcha: getCaptchaAnswer(),
                    captchaId: captcha.captchaId
                })
            });
        };

        assert.equal((await login()).status, 200);
        assert.equal((await login()).status, 200);
    });
});

test('default-password sessions can only change password or log out', async () => {
    await withServer({ initialPassword: null }, async ({ baseUrl, getCaptchaAnswer }) => {
        const captcha = await fetch(`${baseUrl}/api/captcha`).then(response => response.json());
        const login = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'Admin@123',
                captcha: getCaptchaAnswer(),
                captchaId: captcha.captchaId
            })
        });
        const cookie = login.headers.get('set-cookie');
        assert.equal((await login.json()).requirePasswordChange, true);
        const blocked = await fetch(`${baseUrl}/api/protected`, { headers: { Cookie: cookie } });
        assert.equal(blocked.status, 428);
        assert.equal((await blocked.json()).code, 'PASSWORD_CHANGE_REQUIRED');
        assert.equal((await fetch(`${baseUrl}/api/password-status`, { headers: { Cookie: cookie } })).status, 200);
    });
});

test('captcha issuance is bounded per IP', async () => {
    const limiter = createLoginRateLimiter({
        maxAttempts: 1,
        windowMs: 60000,
        errorMessage: '验证码请求过多，请稍后重试'
    });
    await withServer({ captchaRateLimiter: limiter }, async ({ baseUrl }) => {
        assert.equal((await fetch(`${baseUrl}/api/captcha`)).status, 200);
        const limited = await fetch(`${baseUrl}/api/captcha`);
        assert.equal(limited.status, 429);
        assert.match((await limited.json()).error, /验证码请求过多/);
    });
});

test('sessions persist in SQLite and are removed from auth.json', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ccfwp-session-db-test-'));
    const authFile = path.join(directory, 'auth.json');
    const db = createDatabase({
        databaseFile: path.join(directory, 'control-plane.sqlite3'),
        projectsFile: path.join(directory, 'projects.json'),
        resourcesFile: path.join(directory, 'resources.json')
    });
    try {
        const first = createAuthService({ db, authFile, initialPassword: 'StrongPass123', now: () => 1000 });
        await first.initialize();
        const token = await first.createSession();
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 1);
        assert.equal(Object.hasOwn(JSON.parse(await fs.promises.readFile(authFile, 'utf8')), 'sessions'), false);

        const second = createAuthService({ db, authFile, initialPassword: null, now: () => 1000 });
        await second.initialize();
        assert.equal(second.verifySession(token).role, 'admin');
        await second.revokeSession(token);
        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 0);
    } finally {
        db.close();
        await fs.promises.rm(directory, { recursive: true, force: true });
    }
});

test('production startup rejects the bootstrap default password', () => {
    assert.throws(
        () => assertProductionPasswordConfigured({ isDefaultPassword: () => true }, { NODE_ENV: 'production' }),
        /refusing production startup/i
    );
    assert.doesNotThrow(
        () => assertProductionPasswordConfigured({ isDefaultPassword: () => false }, { NODE_ENV: 'production' })
    );
    assert.doesNotThrow(
        () => assertProductionPasswordConfigured({ isDefaultPassword: () => true }, { NODE_ENV: 'development' })
    );
});
