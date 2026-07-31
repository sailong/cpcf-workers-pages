'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgsStringToArgv } = require('string-argv');
const { validateCommand } = require('./safe-exec');

const PACKAGE_MANAGERS = new Set(['npm', 'yarn', 'pnpm']);
const SCRIPT_SUBCOMMANDS = new Set(['run', 'build', 'test', 'start', 'preview']);
const LOCK_FILES = {
    npm: 'package-lock.json',
    yarn: 'yarn.lock',
    pnpm: 'pnpm-lock.yaml'
};
const DANGEROUS_NODE_FLAGS = new Set([
    '-e', '--eval', '-p', '--print', '-r', '--require', '--import', '-i', '--interactive'
]);

function hasFlag(args, flag) {
    return args.some(arg => arg === flag || arg.startsWith(`${flag}=`));
}

function isNetworkInstallCommand(entry) {
    if (!entry || !PACKAGE_MANAGERS.has(entry.file)) return false;
    const [subcommand, ...rest] = entry.args;
    if (entry.file === 'npm') {
        if (subcommand === 'ci') return true;
        if (subcommand === 'install') {
            // Only allow lockfile-driven installs. Bare `npm install` / `npm install pkg`
            // would make uploaded package.json fully trusted for dependency resolution.
            if (rest.length === 0) return true;
            if (rest.every(arg => arg.startsWith('-'))) return true;
            return false;
        }
        return false;
    }
    if (entry.file === 'yarn') {
        if (subcommand === 'install' || subcommand === undefined) {
            // yarn install with no package args
            return rest.every(arg => arg.startsWith('-') || arg === 'install');
        }
        return false;
    }
    if (entry.file === 'pnpm') {
        if (subcommand === 'install' || subcommand === 'ci') {
            return rest.every(arg => arg.startsWith('-'));
        }
        return false;
    }
    return false;
}

function commandNeedsNetwork(entry) {
    return isNetworkInstallCommand(entry);
}

function hasIgnoreScripts(args) {
    return args.some(arg => arg === '--ignore-scripts' || arg.startsWith('--ignore-scripts='));
}

function normalizeCommandEntry(entry, options = {}) {
    const args = [...entry.args];
    if (isNetworkInstallCommand(entry)) {
        // Force non-mutating lock installs for yarn/pnpm when possible.
        if (entry.file === 'yarn' && !hasFlag(args, '--frozen-lockfile')) {
            args.push('--frozen-lockfile');
        }
        if (entry.file === 'pnpm' && entry.args[0] === 'install' && !hasFlag(args, '--frozen-lockfile')) {
            args.push('--frozen-lockfile');
        }
        if (!hasIgnoreScripts(args)) args.push('--ignore-scripts');
        if (options.preferOffline) {
            if (entry.file === 'npm' && !hasFlag(args, '--prefer-offline')) args.push('--prefer-offline');
            if (entry.file === 'yarn' && !hasFlag(args, '--offline') && !hasFlag(args, '--prefer-offline')) args.push('--prefer-offline');
            if (entry.file === 'pnpm' && !hasFlag(args, '--prefer-offline')) args.push('--prefer-offline');
        }
        if (options.offline) {
            if (entry.file === 'npm' && !hasFlag(args, '--offline')) args.push('--offline');
            if (entry.file === 'yarn' && !hasFlag(args, '--offline')) args.push('--offline');
            if (entry.file === 'pnpm' && !hasFlag(args, '--offline')) args.push('--offline');
        }
    }
    return {
        file: entry.file,
        args,
        sanitized: [entry.file, ...args].join(' ')
    };
}

function shellQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function joinCommandEntries(entries) {
    return entries
        .map(entry => [entry.file, ...entry.args].map(shellQuote).join(' '))
        .join(' && ');
}

function readPackageScripts(workDirectory) {
    const packageJsonPath = path.join(workDirectory, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return null;

    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (error) {
        const failure = new Error(`package.json is invalid: ${error.message}`);
        failure.statusCode = 400;
        throw failure;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        const failure = new Error('package.json must contain a JSON object');
        failure.statusCode = 400;
        throw failure;
    }

    if (parsed.scripts == null) return {};
    if (typeof parsed.scripts !== 'object' || Array.isArray(parsed.scripts)) {
        const failure = new Error('package.json scripts must be an object');
        failure.statusCode = 400;
        throw failure;
    }
    return parsed.scripts;
}

function assertInstallLockfile(entry, workDirectory) {
    if (!isNetworkInstallCommand(entry)) return;
    // Reject package-adding installs such as `npm install lodash`.
    const rest = entry.args.slice(1);
    if (entry.file === 'npm' && entry.args[0] === 'install' && rest.some(arg => !arg.startsWith('-'))) {
        const error = new Error('npm install <package> is not allowed; only lockfile installs are permitted');
        error.statusCode = 400;
        throw error;
    }
    if ((entry.file === 'yarn' || entry.file === 'pnpm') && entry.args[0] === 'add') {
        const error = new Error(`${entry.file} add is not allowed; only lockfile installs are permitted`);
        error.statusCode = 400;
        throw error;
    }

    // Prefer ci for npm. Bare install is allowed only when package-lock.json exists.
    if (entry.file === 'npm' && entry.args[0] === 'install') {
        const lockfile = path.join(workDirectory, LOCK_FILES.npm);
        if (!fs.existsSync(lockfile)) {
            const error = new Error('npm install requires package-lock.json; use a locked dependency set');
            error.statusCode = 400;
            throw error;
        }
    }
    if (entry.file === 'yarn') {
        const lockfile = path.join(workDirectory, LOCK_FILES.yarn);
        if (!fs.existsSync(lockfile)) {
            const error = new Error('yarn install requires yarn.lock; use a locked dependency set');
            error.statusCode = 400;
            throw error;
        }
    }
    if (entry.file === 'pnpm') {
        const lockfile = path.join(workDirectory, LOCK_FILES.pnpm);
        if (!fs.existsSync(lockfile)) {
            const error = new Error('pnpm install requires pnpm-lock.yaml; use a locked dependency set');
            error.statusCode = 400;
            throw error;
        }
    }
    if (entry.file === 'npm' && entry.args[0] === 'ci') {
        const lockfile = path.join(workDirectory, LOCK_FILES.npm);
        if (!fs.existsSync(lockfile)) {
            const error = new Error('npm ci requires package-lock.json');
            error.statusCode = 400;
            throw error;
        }
    }
}

function resolveScriptName(entry) {
    if (!PACKAGE_MANAGERS.has(entry.file)) return null;
    const [subcommand, maybeScript] = entry.args;

    if (entry.file === 'npm' || entry.file === 'pnpm') {
        if (subcommand === 'run') return maybeScript || null;
        if (subcommand === 'test') return 'test';
        if (subcommand === 'start') return 'start';
        return null;
    }

    if (entry.file === 'yarn') {
        if (subcommand === 'run') return maybeScript || null;
        if (SCRIPT_SUBCOMMANDS.has(subcommand) && subcommand !== 'run') return subcommand;
    }
    return null;
}

function validateNodeScript(args) {
    if (!args.length) {
        return { valid: false, error: 'node 命令必须指定相对路径脚本文件' };
    }
    for (const arg of args) {
        if (
            DANGEROUS_NODE_FLAGS.has(arg)
            || arg.startsWith('--eval=')
            || arg.startsWith('--print=')
            || arg.startsWith('--require=')
            || arg.startsWith('--import=')
        ) {
            return { valid: false, error: `node 不允许使用参数: ${arg}` };
        }
    }

    const scriptPath = args.find(arg => !arg.startsWith('-'));
    if (!scriptPath) {
        return { valid: false, error: 'node 命令必须指定相对路径脚本文件' };
    }
    if (
        path.isAbsolute(scriptPath)
        || scriptPath.includes('..')
        || scriptPath.includes('\\')
        || scriptPath.startsWith('~')
    ) {
        return { valid: false, error: 'node 脚本路径必须是工作区内的相对路径' };
    }
    return { valid: true };
}

function validateExpandedCommand(command) {
    const validation = validateCommand(command);
    if (validation.valid) return validation;

    const trimmed = String(command || '').trim();
    if (!trimmed.startsWith('node ') && trimmed !== 'node') return validation;

    try {
        const parts = parseArgsStringToArgv(trimmed);
        if (parts[0] !== 'node') return validation;
        const nodeValidation = validateNodeScript(parts.slice(1));
        if (!nodeValidation.valid) return nodeValidation;
        return {
            valid: true,
            sanitized: trimmed,
            file: 'node',
            args: parts.slice(1),
            commands: [{ file: 'node', args: parts.slice(1), sanitized: trimmed }]
        };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

function assertPackageScriptsSafe(entries, workDirectory, stack = []) {
    const scripts = readPackageScripts(workDirectory);

    for (const entry of entries) {
        const scriptName = resolveScriptName(entry);
        if (!scriptName) continue;

        if (scripts == null) {
            const error = new Error('package.json is required before running package scripts');
            error.statusCode = 400;
            throw error;
        }
        if (!Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
            const error = new Error(`package.json 中不存在脚本: ${scriptName}`);
            error.statusCode = 400;
            throw error;
        }

        const scriptBody = scripts[scriptName];
        if (typeof scriptBody !== 'string' || !scriptBody.trim()) {
            const error = new Error(`package.json 脚本 ${scriptName} 必须是非空字符串`);
            error.statusCode = 400;
            throw error;
        }

        const key = `${workDirectory}::${scriptName}`;
        if (stack.includes(key)) {
            const error = new Error(`package.json 脚本存在循环引用: ${stack.concat(key).join(' -> ')}`);
            error.statusCode = 400;
            throw error;
        }

        const expanded = validateExpandedCommand(scriptBody);
        if (!expanded.valid) {
            const error = new Error(`package.json 脚本 ${scriptName} 不安全: ${expanded.error}`);
            error.statusCode = 400;
            throw error;
        }
        assertPackageScriptsSafe(expanded.commands, workDirectory, stack.concat(key));
    }
}

function planBuildCommand(command, workDirectory = process.cwd(), options = {}) {
    if (typeof command !== 'string' || !command.trim() || command.includes('\0') || command.length > 8192) {
        const error = new Error('Build command must be a non-empty string of at most 8192 characters');
        error.statusCode = 400;
        throw error;
    }

    const validation = validateCommand(command);
    if (!validation.valid) {
        const error = new Error(`命令验证失败: ${validation.error}`);
        error.statusCode = 400;
        throw error;
    }

    // Reject package-adding commands early, even before lockfile checks.
    for (const entry of validation.commands) {
        if (PACKAGE_MANAGERS.has(entry.file) && entry.args[0] === 'add') {
            const error = new Error(`${entry.file} add is not allowed; only lockfile installs are permitted`);
            error.statusCode = 400;
            throw error;
        }
        if (entry.file === 'npm' && entry.args[0] === 'install' && entry.args.slice(1).some(arg => !arg.startsWith('-'))) {
            const error = new Error('npm install <package> is not allowed; only lockfile installs are permitted');
            error.statusCode = 400;
            throw error;
        }
    }

    for (const entry of validation.commands) assertInstallLockfile(entry, workDirectory);

    const networkMode = String(options.networkMode || process.env.BUILD_NETWORK_MODE || 'prefer-offline').toLowerCase();
    const normalizedEntries = validation.commands.map(entry => normalizeCommandEntry(entry, {
        preferOffline: networkMode === 'prefer-offline',
        offline: networkMode === 'offline'
    }));
    assertPackageScriptsSafe(normalizedEntries, workDirectory);

    const stages = [];
    for (const entry of normalizedEntries) {
        const needsNetwork = commandNeedsNetwork(entry);
        const previous = stages[stages.length - 1];
        if (!previous || previous.needsNetwork !== needsNetwork) {
            stages.push({
                needsNetwork,
                entries: [entry],
                command: joinCommandEntries([entry])
            });
        } else {
            previous.entries.push(entry);
            previous.command = joinCommandEntries(previous.entries);
        }
    }

    return {
        sanitized: joinCommandEntries(normalizedEntries),
        stages,
        needsNetwork: stages.some(stage => stage.needsNetwork)
    };
}

module.exports = {
    assertPackageScriptsSafe,
    commandNeedsNetwork,
    isNetworkInstallCommand,
    joinCommandEntries,
    normalizeCommandEntry,
    planBuildCommand,
    shellQuote
};
