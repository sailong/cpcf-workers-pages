/**
 * SSE (Server-Sent Events) 辅助工具
 * 提供超时、心跳和资源清理功能
 */

const SSE_TIMEOUT = 30 * 60 * 1000; // 30 分钟超时
const SSE_HEARTBEAT_INTERVAL = 30 * 1000; // 30 秒心跳

/**
 * 创建 SSE 连接管理器
 * @param {import('express').Response} res - Express 响应对象
 * @param {Object} options - 配置选项
 * @returns {Object} SSE 管理器
 */
function createSSEManager(res, options = {}) {
    const {
        timeout = SSE_TIMEOUT,
        heartbeatInterval = SSE_HEARTBEAT_INTERVAL,
        onTimeout = null,
        onClose = null,
        onEvent = null
    } = options;

    // 获取 request 对象
    const req = res.req;

    let timeoutId = null;
    let heartbeatId = null;
    let isClosed = false;

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
    if (res.flushHeaders) res.flushHeaders();

    // 发送消息
    const send = (type, data) => {
        if (isClosed) return false;
        try {
            res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
            if (res.flush) res.flush();
            if (onEvent) onEvent(type, data);
            return true;
        } catch (e) {
            console.error('[SSE] Send error:', e.message);
            close();
            return false;
        }
    };

    // 发送日志
    const sendLog = (content) => send('log', { content });
    
    // 发送错误
    const sendError = (content) => send('error', { content });
    
    // 发送结果
    const sendResult = (data) => send('result', data);

    // 发送心跳
    const sendHeartbeat = () => {
        if (isClosed) return;
        try {
            res.write(': heartbeat\n\n');
            if (res.flush) res.flush();
        } catch (e) {
            console.error('[SSE] Heartbeat error:', e.message);
            close();
        }
    };

    // 设置超时
    const setupTimeout = () => {
        timeoutId = setTimeout(() => {
            console.log('[SSE] Connection timeout');
            sendError('连接超时');
            if (onTimeout) onTimeout();
            close();
        }, timeout);
    };

    // 设置心跳
    const setupHeartbeat = () => {
        heartbeatId = setInterval(sendHeartbeat, heartbeatInterval);
    };

    // 关闭连接
    const close = () => {
        if (isClosed) return;
        isClosed = true;

        if (timeoutId) clearTimeout(timeoutId);
        if (heartbeatId) clearInterval(heartbeatId);

        try {
            res.end();
        } catch (e) {
            // 忽略已关闭的连接错误
        }

        if (onClose) onClose();
    };

    // IncomingMessage emits close after a normal request body completes. Only
    // aborted requests or a response socket closing before end are disconnects.
    req.on('aborted', () => {
        console.log('[SSE] Client aborted request');
        close();
    });
    res.on('close', () => {
        if (!isClosed && !res.writableEnded) {
            console.log('[SSE] Client disconnected');
            close();
        }
    });

    // 初始化
    setupTimeout();
    setupHeartbeat();

    return {
        send,
        sendLog,
        sendError,
        sendResult,
        close,
        isClosed: () => isClosed
    };
}

function createRecordedSSEManager(res, recorder, options = {}) {
    const sse = createSSEManager(res, options);
    const send = (type, data) => {
        recorder.onEvent(type, data);
        return sse.send(type, data);
    };
    return {
        ...sse,
        send,
        sendLog: content => send('log', { content }),
        sendError: content => send('error', { content }),
        sendResult: data => send('result', data)
    };
}

/**
 * 清理临时文件
 * @param {string[]} filePaths - 要清理的文件路径数组
 */
async function cleanupTempFiles(filePaths) {
    const fs = require('fs');
    
    for (const filePath of filePaths) {
        try {
            if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(filePath);
                }
                console.log(`[Cleanup] Removed: ${filePath}`);
            }
        } catch (e) {
            console.warn(`[Cleanup] Failed to remove ${filePath}:`, e.message);
        }
    }
}

/**
 * 创建临时文件清理器（确保异常时也能清理）
 * @param {string[]} filePaths - 要清理的文件路径数组
 * @returns {Object} 清理器对象
 */
function createTempFileCleaner(filePaths) {
    let cleaned = false;

    const removeHandler = () => {
        process.off('exit', exitHandler);
        process.off('SIGINT', exitHandler);
        process.off('SIGTERM', exitHandler);
        process.off('uncaughtException', exitHandler);
    };

    const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        removeHandler();
        await cleanupTempFiles(filePaths);
    };

    // 注册进程退出时的清理
    const exitHandler = () => cleanup();
    process.on('exit', exitHandler);
    process.on('SIGINT', exitHandler);
    process.on('SIGTERM', exitHandler);
    process.on('uncaughtException', exitHandler);

    return {
        cleanup,
        addFile: (filePath) => {
            if (!filePaths.includes(filePath)) {
                filePaths.push(filePath);
            }
        },
        removeHandler
    };
}

module.exports = {
    createSSEManager,
    createRecordedSSEManager,
    cleanupTempFiles,
    createTempFileCleaner,
    SSE_TIMEOUT,
    SSE_HEARTBEAT_INTERVAL
};
