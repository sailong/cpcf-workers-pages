/**
 * 安全命令执行工具
 * 防止命令注入攻击，只允许预定义的安全命令
 */

const { spawn } = require('child_process');

// 允许的命令白名单
const ALLOWED_COMMANDS = {
    // 包管理器
    'npm': {
        allowedSubcommands: ['install', 'ci', 'run', 'build', 'test', 'start', 'preview'],
        allowArgs: true
    },
    'yarn': {
        allowedSubcommands: ['install', 'add', 'build', 'test', 'start'],
        allowArgs: true
    },
    'pnpm': {
        allowedSubcommands: ['install', 'add', 'build', 'test', 'start'],
        allowArgs: true
    },
    // 构建工具
    'vite': {
        allowedSubcommands: ['build', 'preview'],
        allowArgs: true
    },
    'next': {
        allowedSubcommands: ['build', 'export'],
        allowArgs: true
    },
    'tsc': {
        allowedSubcommands: null,
        allowArgs: true
    },
    'esbuild': {
        allowedSubcommands: null,
        allowArgs: true
    },
    'wrangler': {
        allowedSubcommands: ['deploy', 'pages', 'tail'],
        allowArgs: true
    }
};

// 危险字符黑名单
const DANGEROUS_PATTERNS = [
    /[;&|`$]/,           // 命令链接和替换
    /\$\(/,              // 命令替换 $(...)
    /`[^`]*`/,           // 反引号命令替换
    />\s*\//,            // 重定向到根目录
    /<\s*\//,            // 从根目录读取
    /\.\.\//,            // 目录遍历
    /~\//,               // 家目录访问
    /\|\s*\w+/,          // 管道命令
    /\$\{/,              // 变量替换
    /\$\w+/,             // 环境变量引用（除了特定情况）
];

/**
 * 验证命令是否安全
 * @param {string} command - 要验证的命令
 * @returns {{ valid: boolean, error?: string, sanitized?: string }}
 */
function validateCommand(command) {
    if (!command || typeof command !== 'string') {
        return { valid: false, error: '命令不能为空' };
    }

    // 去除首尾空格
    const trimmedCmd = command.trim();

    // 检查危险模式
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(trimmedCmd)) {
            return { 
                valid: false, 
                error: `命令包含不允许的字符或模式: ${pattern.source}` 
            };
        }
    }

    // 解析命令
    const parts = trimmedCmd.split(/\s+/);
    const baseCmd = parts[0];
    const args = parts.slice(1);

    // 检查基础命令是否在白名单中
    const cmdConfig = ALLOWED_COMMANDS[baseCmd];
    if (!cmdConfig) {
        return { 
            valid: false, 
            error: `不允许的命令: ${baseCmd}。允许的命令: ${Object.keys(ALLOWED_COMMANDS).join(', ')}` 
        };
    }

    // 检查子命令（如果有配置）
    if (cmdConfig.allowedSubcommands && args.length > 0) {
        const subCmd = args[0];
        if (!cmdConfig.allowedSubcommands.includes(subCmd)) {
            // 对于 npx，允许执行任何包名
            if (baseCmd !== 'npx') {
                return { 
                    valid: false, 
                    error: `命令 ${baseCmd} 不允许子命令: ${subCmd}` 
                };
            }
        }
    }

    return { valid: true, sanitized: trimmedCmd };
}

/**
 * 安全执行命令
 * @param {string} command - 要执行的命令
 * @param {Object} options - spawn 选项
 * @param {function} onStdout - stdout 回调
 * @param {function} onStderr - stderr 回调
 * @returns {Promise<{ success: boolean, code?: number, error?: string }>}
 */
async function safeExec(command, options = {}, onStdout = null, onStderr = null) {
    // 验证命令
    const validation = validateCommand(command);
    if (!validation.valid) {
        throw new Error(`命令验证失败: ${validation.error}`);
    }

    const { timeout = 300000 } = options; // 默认 5 分钟超时
    const parts = validation.sanitized.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    return new Promise((resolve, reject) => {
        let timeoutId = null;
        
        const child = spawn(cmd, args, {
            ...options,
            shell: false, // 不使用 shell，更安全
            env: { 
                ...process.env, 
                ...options.env,
                CI: 'true',
                FORCE_COLOR: '1'
            }
        });

        // 设置超时
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error(`命令执行超时 (${timeout}ms): ${command}`));
            }, timeout);
        }

        // 处理输出
        if (onStdout) {
            child.stdout.on('data', (data) => onStdout(data.toString()));
        }
        if (onStderr) {
            child.stderr.on('data', (data) => onStderr(data.toString()));
        }

        child.on('close', (code) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (code === 0) {
                resolve({ success: true, code });
            } else {
                reject(new Error(`命令执行失败，退出码: ${code}`));
            }
        });

        child.on('error', (err) => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(new Error(`命令执行错误: ${err.message}`));
        });
    });
}

/**
 * 安全执行命令（使用 shell，但有严格验证）
 * 用于需要 shell 特性的场景（如 npm run script）
 * @param {string} command - 要执行的命令
 * @param {Object} options - spawn 选项
 * @param {function} onStdout - stdout 回调
 * @param {function} onStderr - stderr 回调
 */
async function safeShellExec(command, options = {}, onStdout = null, onStderr = null) {
    // 验证命令
    const validation = validateCommand(command);
    if (!validation.valid) {
        throw new Error(`命令验证失败: ${validation.error}`);
    }

    const { timeout = 300000 } = options;

    return new Promise((resolve, reject) => {
        let timeoutId = null;

        const child = spawn(validation.sanitized, {
            ...options,
            shell: true,
            env: {
                ...process.env,
                ...options.env,
                CI: 'true',
                FORCE_COLOR: '1'
            }
        });

        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error(`命令执行超时 (${timeout}ms): ${command}`));
            }, timeout);
        }

        if (onStdout) {
            child.stdout.on('data', (data) => onStdout(data.toString()));
        }
        if (onStderr) {
            child.stderr.on('data', (data) => onStderr(data.toString()));
        }

        child.on('close', (code) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (code === 0) {
                resolve({ success: true, code });
            } else {
                reject(new Error(`命令执行失败，退出码: ${code}`));
            }
        });

        child.on('error', (err) => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(new Error(`命令执行错误: ${err.message}`));
        });
    });
}

module.exports = {
    validateCommand,
    safeExec,
    safeShellExec,
    ALLOWED_COMMANDS
};