'use strict';

const express = require('express');
const svgCaptcha = require('svg-captcha');
const authService = require('../services/auth-service');
const { createLoginRateLimiter } = require('../middleware/login-rate-limit');
const { clearSessionCookie, setSessionCookie } = require('../utils/session-cookie');

function createAuthRouter(options = {}) {
    const service = options.authService || authService;
    const loginRateLimiter = options.loginRateLimiter || createLoginRateLimiter();
    const captchaRateLimiter = options.captchaRateLimiter || createLoginRateLimiter({
        maxAttempts: 30,
        windowMs: 5 * 60 * 1000,
        errorMessage: '验证码请求过多，请稍后重试'
    });
    const router = express.Router();

    router.get('/health', (req, res) => {
        res.json({ status: 'ok', time: Date.now() });
    });

    router.get('/captcha', captchaRateLimiter, (req, res) => {
        const captcha = svgCaptcha.create({
            size: 4,
            ignoreChars: '0o1i',
            noise: 2,
            color: true
        });
        const captchaId = service.createCaptchaChallenge(captcha.text);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ image: captcha.data, captchaId });
    });

    router.post('/login', loginRateLimiter, async (req, res) => {
        const { username, password, captcha, captchaId } = req.body || {};
        if (!captcha || !captchaId) return res.status(400).json({ error: '请输入验证码' });
        if (!service.consumeCaptchaChallenge(captchaId, captcha)) {
            return res.status(400).json({ error: '验证码错误或已失效，请刷新' });
        }
        if (username !== 'admin' || !(await service.verifyPassword(password))) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = await service.createSession();
        setSessionCookie(res, token);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, requirePasswordChange: service.isDefaultPassword() });
    });

    router.get('/verify-session', (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            authenticated: true,
            expiresAt: req.user.expiresAt,
            requirePasswordChange: service.isDefaultPassword()
        });
    });

    router.post('/logout', async (req, res) => {
        await service.revokeSession(req.sessionToken);
        clearSessionCookie(res);
        res.json({ success: true });
    });

    router.get('/password-status', (req, res) => {
        res.json({ isDefaultPassword: service.isDefaultPassword(), rules: service.PASSWORD_RULES });
    });

    router.post('/change-password', async (req, res) => {
        const { oldPassword, newPassword } = req.body || {};
        if (!(await service.verifyPassword(oldPassword))) {
            return res.status(400).json({ error: '旧密码错误' });
        }
        const validation = service.validatePasswordStrength(newPassword);
        if (!validation.valid) {
            return res.status(400).json({ error: '密码不符合要求', details: validation.errors });
        }

        await service.setPassword(newPassword);
        clearSessionCookie(res);
        res.json({ success: true, sessionRevoked: true });
    });

    return router;
}

const router = createAuthRouter();
router.createAuthRouter = createAuthRouter;

module.exports = router;
