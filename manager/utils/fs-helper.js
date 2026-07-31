const fs = require('fs');
const path = require('path');

/**
 * 如果目录中只包含一个子文件夹（或包含一个子文件夹+一些隐藏文件），
 * 则将该子文件夹的内容移动到父目录，并删除子文件夹。
 * @param {string} dir 目标目录路径
 */
function flattenDirectory(dir) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;

    // 获取所有非隐藏文件/文件夹
    const items = fs.readdirSync(dir).filter(i => !i.startsWith('.') && i !== '__MACOSX');

    // 如果只有一个项目，且是目录
    if (items.length === 1) {
        const subPath = path.join(dir, items[0]);
        if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
            console.log(`[FS Helper] Detected nested directory: ${items[0]}. Flattening...`);

            // 将子目录下的所有文件（包括隐藏文件）移动到当前目录
            const subItems = fs.readdirSync(subPath);
            subItems.forEach(item => {
                const oldPath = path.join(subPath, item);
                const newPath = path.join(dir, item);

                if (fs.existsSync(newPath)) {
                    // 如果存在冲突，如果是目录则递归删除，文件则直接删除
                    fs.rmSync(newPath, { recursive: true, force: true });
                }

                fs.renameSync(oldPath, newPath);
            });

            // 尝试删除子目录
            try {
                fs.rmSync(subPath, { recursive: true, force: true });
            } catch (e) {
                console.error(`[FS Helper] Failed to remove subPath ${subPath}:`, e.message);
            }

            // 递归检查，防止多层嵌套 (e.g. wrapper/wrapper/project)
            flattenDirectory(dir);
        }
    } else if (items.length === 0) {
        // 如果根本没有非隐藏文件，但可能有一个隐藏文件夹包含内容？比较罕见，暂不处理
    }
}

function getDirectorySize(target) {
    if (!fs.existsSync(target)) return 0;
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) return 0;
    if (stat.isFile()) return stat.size;
    if (!stat.isDirectory()) return 0;
    return fs.readdirSync(target).reduce((total, entry) => total + getDirectorySize(path.join(target, entry)), 0);
}

function assertWithinByteLimit(size, limitBytes, message) {
    if (size > limitBytes) {
        const error = new Error(message || `Size limit exceeded (${limitBytes} bytes)`);
        error.statusCode = 413;
        throw error;
    }
    return size;
}

function assertPathWithinByteLimit(target, limitBytes, message) {
    return assertWithinByteLimit(getDirectorySize(target), limitBytes, message);
}

module.exports = {
    flattenDirectory,
    getDirectorySize,
    assertWithinByteLimit,
    assertPathWithinByteLimit
};
