/**
 * 安全命令执行工具
 * 防止命令注入攻击，只允许预定义的安全命令
 */

const { spawn } = require('child_process');
const { parseArgsStringToArgv } = require('string-argv');
const { createRuntimeEnvironment } = require('./runtime-environment');
const { createAbortError, throwIfAborted } = require('./abort');

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

// 危险字符黑名单。顶层 && 由 splitCommandSequence 显式解析，其他
// shell 控制操作符一律拒绝；命令始终通过 spawn(..., { shell: false }) 执行。
const DANGEROUS_PATTERNS = [
    /[;|`$]/,            // 命令链接、管道、替换和变量展开
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
 * Split a command into a small, explicit sequence. Only top-level && is
 * supported so generated builds such as "npm install && npm run build" work
 * without handing arbitrary shell syntax to the process provider.
 */
function splitCommandSequence(command) {
    const commands = [];
    let start = 0;
    let quote = null;
    let escaped = false;

    for (let index = 0; index < command.length; index += 1) {
        const character = command[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (character === '\\' && quote !== "'") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (character === quote) quote = null;
            continue;
        }
        if (character === "'" || character === '"') {
            quote = character;
            continue;
        }
        if (character === '&') {
            if (command[index + 1] !== '&') {
                throw new Error('命令只允许使用顶层 && 连接多个步骤');
            }
            const segment = command.slice(start, index).trim();
            if (!segment) throw new Error('&& 两侧必须是有效命令');
            commands.push(segment);
            index += 1;
            start = index + 1;
        }
    }

    if (quote || escaped) throw new Error('命令包含未闭合的引号或转义字符');
    const finalSegment = command.slice(start).trim();
    if (!finalSegment) throw new Error('&& 后必须提供有效命令');
    commands.push(finalSegment);
    return commands;
}

function validateSingleCommand(command) {
    const trimmedCmd = command.trim();
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(trimmedCmd)) {
            return {
                valid: false,
                error: `命令包含不允许的字符或模式: ${pattern.source}`
            };
        }
    }

    const parts = parseArgsStringToArgv(trimmedCmd);
    const baseCmd = parts[0];
    const args = parts.slice(1);
    const cmdConfig = ALLOWED_COMMANDS[baseCmd];
    if (!cmdConfig) {
        return {
            valid: false,
            error: `不允许的命令: ${baseCmd}。允许的命令: ${Object.keys(ALLOWED_COMMANDS).join(', ')}`
        };
    }

    if (cmdConfig.allowedSubcommands && args.length > 0) {
        const subCmd = args[0];
        if (!cmdConfig.allowedSubcommands.includes(subCmd)) {
            return {
                valid: false,
                error: `命令 ${baseCmd} 不允许子命令: ${subCmd}`
            };
        }
    }

    return { valid: true, sanitized: trimmedCmd, file: baseCmd, args };
}

/**
 * 验证命令是否安全
 * @param {string} command - 要验证的命令
 * @returns {{ valid: boolean, error?: string, sanitized?: string }}
 */
function validateCommand(command) {
    if (!command || typeof command !== 'string') {
        return { valid: false, error: '命令不能为空' };
    }

    const trimmedCmd = command.trim();
    let segments;
    try {
        segments = splitCommandSequence(trimmedCmd);
    } catch (error) {
        return { valid: false, error: error.message };
    }
    const commands = [];
    for (const segment of segments) {
        const validation = validateSingleCommand(segment);
        if (!validation.valid) return validation;
        commands.push(validation);
    }
    return {
        valid: true,
        sanitized: trimmedCmd,
        file: commands[0].file,
        args: commands[0].args,
        commands
    };
}

/**
 * 安全执行单个白名单命令，不经过 shell。
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

    const { timeout = 300000, env: requestedEnvironment = {}, signal, ...spawnOptions } = options;
    throwIfAborted(signal);

    const commands = validation.commands || [validation];
    const deadline = timeout > 0 ? Date.now() + timeout : null;

    const executeOne = (entry, remainingTimeout) => new Promise((resolve, reject) => {
        let timeoutId = null;
        let settled = false;
        let forceTimer = null;
        const child = spawn(entry.file, entry.args, {
            ...spawnOptions,
            env: createRuntimeEnvironment({
                ...requestedEnvironment,
                CI: 'true',
                FORCE_COLOR: '1'
            }),
            detached: process.platform !== 'win32'
        });

        const terminate = signal => {
            try {
                if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
                else child.kill(signal);
            } catch { }
        };

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            signal?.removeEventListener('abort', onAbort);
        };

        const rejectAndTerminate = error => {
            if (settled) return;
            settled = true;
            cleanup();
            terminate('SIGTERM');
            forceTimer = setTimeout(() => terminate('SIGKILL'), 2_000);
            forceTimer.unref();
            reject(error);
        };

        const onAbort = () => rejectAndTerminate(createAbortError());
        signal?.addEventListener('abort', onAbort, { once: true });

        if (remainingTimeout > 0) {
            timeoutId = setTimeout(() => {
                rejectAndTerminate(new Error(`命令执行超时 (${remainingTimeout}ms): ${entry.sanitized}`));
            }, remainingTimeout);
        }

        if (onStdout) {
            child.stdout.on('data', (data) => onStdout(data.toString()));
        }
        if (onStderr) {
            child.stderr.on('data', (data) => onStderr(data.toString()));
        }

        child.on('close', (code) => {
            cleanup();
            if (forceTimer) clearTimeout(forceTimer);
            if (settled) return;
            settled = true;
            if (code === 0) {
                resolve({ success: true, code });
            } else {
                reject(new Error(`命令执行失败，退出码: ${code}: ${entry.sanitized}`));
            }
        });

        child.on('error', (err) => {
            cleanup();
            if (settled) return;
            settled = true;
            reject(new Error(`命令执行错误: ${err.message}`));
        });
    });

    for (const entry of commands) {
        throwIfAborted(signal);
        const remainingTimeout = deadline === null ? 0 : deadline - Date.now();
        if (remainingTimeout <= 0 && deadline !== null) {
            throw new Error(`命令执行超时 (${timeout}ms): ${command}`);
        }
        await executeOne(entry, remainingTimeout);
    }
    return { success: true, code: 0 };
}

module.exports = {
    validateCommand,
    splitCommandSequence,
    safeShellExec,
    ALLOWED_COMMANDS
};
