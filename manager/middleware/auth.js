const jwt = require('jsonwebtoken');
const authService = require('../services/auth-service');

module.exports = function authMiddleware(req, res, next) {
    // Only protect /api routes
    if (!req.path.startsWith('/api/')) return next();

    // Whitelist public routes
    const publicRoutes = ['/api/login', '/api/health', '/api/captcha'];
    if (publicRoutes.includes(req.path)) return next();

    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        // Use current secret from service
        jwt.verify(token, authService.getJwtSecret(), (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};
