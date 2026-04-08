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
    });

    const captchaToken = jwt.sign(
        { text: captcha.text.toLowerCase(), iat: Date.now() },
        authService.getJwtSecret(),
        { expiresIn: '5m' }
    );

    res.json({
        image: captcha.data,
        captchaId: captchaToken
    });
});

// Login
router.post('/login', async (req, res) => {
    const { username, password, captcha, captchaId } = req.body;

    // 1. 验证验证码
    if (!captcha || !captchaId) {
        return res.status(400).json({ error: "请输入验证码" });
    }

    try {
        const decoded = jwt.verify(captchaId, authService.getJwtSecret());
        
        // 检查验证码是否过期（5 分钟）
        const now = Date.now();
        const issuedAt = decoded.iat * 1000; // JWT iat 是秒，转换为毫秒
        if (now - issuedAt > 5 * 60 * 1000) {
            return res.status(400).json({ error: "验证码已过期，请刷新" });
        }
        
        if (decoded.text !== captcha.toLowerCase()) {
            return res.status(400).json({ error: "验证码错误" });
        }
    } catch (e) {
        return res.status(400).json({ error: "验证码失效，请刷新" });
    }

    // 2. 验证用户名
    if (username !== 'admin') {
        return res.status(401).json({ error: "用户名或密码错误" });
    }

    // 3. 验证密码（异步 bcrypt）
    try {
        const isValid = await authService.verifyPassword(password);
        if (isValid) {
            const token = jwt.sign({ role: 'admin' }, authService.getJwtSecret(), { expiresIn: '7d' });
            const requirePasswordChange = authService.isDefaultPassword();
            
            return res.json({ 
                success: true, 
                token,
                requirePasswordChange
            });
        }
    } catch (e) {
        console.error('[Login] Password verification error:', e);
    }

    res.status(401).json({ error: "用户名或密码错误" });
});

// Check if using default password
router.get('/password-status', (req, res) => {
    res.json({
        isDefaultPassword: authService.isDefaultPassword(),
        rules: authService.PASSWORD_RULES
    });
});

// Change Password
router.post('/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    try {
        // 验证旧密码
        const isValid = await authService.verifyPassword(oldPassword);
        if (!isValid) {
            return res.status(400).json({ error: "旧密码错误" });
        }

        // 验证新密码复杂度
        const validation = authService.validatePasswordStrength(newPassword);
        if (!validation.valid) {
            return res.status(400).json({ 
                error: "密码不符合要求", 
                details: validation.errors 
            });
        }

        // 设置新密码
        await authService.setPassword(newPassword);

        res.json({ success: true });
    } catch (e) {
        console.error('[ChangePassword] Error:', e);
        res.status(500).json({ error: "密码修改失败" });
    }
});

module.exports = router;
