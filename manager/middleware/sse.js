/**
 * SSE 中间件 - 统一 Server-Sent Events 创建逻辑
 * 消除 routes/build.js 和 routes/projects.js 中的重复代码
 */

const { createSSEManager } = require('../utils/sse-helper');

/**
 * SSE 中间件工厂函数
 * @param {Object} options - SSE 配置选项
 * @param {number} options.timeout - 超时时间（毫秒），默认 30 分钟
 * @param {number} options.heartbeatInterval - 心跳间隔（毫秒），默认 30 秒
 * @param {Function} options.onClose - 连接关闭回调
 * @returns {Function} Express 中间件
 */
function sseMiddleware(options = {}) {
    const {
        timeout = 30 * 60 * 1000,
        heartbeatInterval = 30 * 1000,
        onClose = () => {}
    } = options;

    return (req, res, next) => {
        // 创建 SSE 管理器
        const sse = createSSEManager(res, {
            timeout,
            heartbeatInterval,
            onClose
        });

        // 将 sse 附加到 request 对象
        req.sse = sse;

        // 重写 res.json 以防止在 SSE 连接中使用
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            if (!sse.isClosed()) {
                sse.sendResult(data);
            }
        };

        // 添加错误处理
        const handleError = (error) => {
            if (!sse.isClosed()) {
                sse.sendError(error.message || 'Unknown error');
                sse.close();
            }
        };

        // 将错误处理附加到 response
        res.sseError = handleError;

        next();
    };
}

module.exports = {
    sseMiddleware
};
