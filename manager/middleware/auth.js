'use strict';

const authService = require('../services/auth-service');
const { getSessionToken } = require('../utils/session-cookie');

const PUBLIC_ROUTES = new Set(['/api/login', '/api/health', '/api/captcha']);
const PASSWORD_CHANGE_ROUTES = new Set([
    '/api/change-password',
    '/api/logout',
    '/api/password-status',
    '/api/verify-session'
]);

function createAuthMiddleware(service = authService) {
    return function authMiddleware(req, res, next) {
        if (!req.path.startsWith('/api/') || PUBLIC_ROUTES.has(req.path)) return next();
        const token = getSessionToken(req);
        const session = service.verifySession(token);
        if (!session) return res.sendStatus(401);
        req.user = session;
        req.sessionToken = token;
        if (service.isDefaultPassword() && !PASSWORD_CHANGE_ROUTES.has(req.path)) {
            return res.status(428).json({
                error: '必须先修改初始密码',
                code: 'PASSWORD_CHANGE_REQUIRED'
            });
        }
        next();
    };
}

const middleware = createAuthMiddleware();
middleware.createAuthMiddleware = createAuthMiddleware;

module.exports = middleware;
