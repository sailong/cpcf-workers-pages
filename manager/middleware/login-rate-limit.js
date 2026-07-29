'use strict';

function createLoginRateLimiter(options = {}) {
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const maxAttempts = options.maxAttempts || 5;
    const maxTrackedIps = options.maxTrackedIps || 10000;
    const now = options.now || Date.now;
    const errorMessage = options.errorMessage || '登录尝试过多，请稍后重试';
    const attempts = new Map();

    function middleware(req, res, next) {
        const key = req.ip || req.socket.remoteAddress || 'unknown';
        const timestamp = now();
        let record = attempts.get(key);
        if (!record || record.resetAt <= timestamp) {
            record = { count: 0, resetAt: timestamp + windowMs };
        }
        if (!attempts.has(key) && attempts.size >= maxTrackedIps) {
            attempts.delete(attempts.keys().next().value);
        }

        if (record.count >= maxAttempts) {
            attempts.set(key, record);
            const retryAfter = Math.max(1, Math.ceil((record.resetAt - timestamp) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({ error: errorMessage, retryAfter });
        }

        record.count += 1;
        attempts.set(key, record);
        next();
    }

    middleware.reset = key => attempts.delete(key);
    middleware.resetAll = () => attempts.clear();
    return middleware;
}

module.exports = { createLoginRateLimiter };
