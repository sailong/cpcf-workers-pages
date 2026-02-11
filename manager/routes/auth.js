const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const authService = require('../services/auth-service');

// Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
});

// Captcha
router.get('/captcha', (req, res) => {
    const captcha = svgCaptcha.create({
        size: 4,
        ignoreChars: '0o1i',
        noise: 2,
        color: true,
        background: '#111827' // gray-900 to match dark theme
    });

    // Sign the captcha text into a token (avoid session state)
    const captchaToken = jwt.sign(
        { text: captcha.text.toLowerCase() },
        authService.getJwtSecret(),
        { expiresIn: '5m' }
    );

    res.json({
        image: captcha.data,
        captchaId: captchaToken
    });
});

// Login
router.post('/login', (req, res) => {
    const { username, password, captcha, captchaId } = req.body;

    // 1. Verify Captcha
    if (!captcha || !captchaId) {
        return res.status(400).json({ error: "请输入验证码" });
    }

    try {
        const decoded = jwt.verify(captchaId, authService.getJwtSecret());
        if (decoded.text !== captcha.toLowerCase()) {
            return res.status(400).json({ error: "验证码错误" });
        }
    } catch (e) {
        return res.status(400).json({ error: "验证码失效，请刷新" });
    }

    // 2. Verify Credentials
    if (username !== 'admin') {
        return res.status(401).json({ error: "用户名或密码错误" });
    }

    if (password === authService.getPassword()) {
        const token = jwt.sign({ role: 'admin' }, authService.getJwtSecret(), { expiresIn: '7d' });
        return res.json({ success: true, token });
    }
    res.status(401).json({ error: "用户名或密码错误" });
});

// Change Password
router.post('/change-password', (req, res) => {
    // Auth is handled by global middleware
    // If we reached here, req.user is populated and token is valid

    const { oldPassword, newPassword } = req.body;

    if (oldPassword !== authService.getPassword()) {
        return res.status(400).json({ error: "旧密码错误" });
    }

    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: "新密码长度至少4位" });
    }

    authService.setPassword(newPassword);

    res.json({ success: true });
});

module.exports = router;
