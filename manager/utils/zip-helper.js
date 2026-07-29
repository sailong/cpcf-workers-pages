'use strict';

const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const { resolveWithin } = require('./path-helper');

const DEFAULT_LIMITS = Object.freeze({
    maxEntries: 5000,
    maxExpandedBytes: 500 * 1024 * 1024,
    maxCompressionRatio: 100
});

function openZip(filePath) {
    return new Promise((resolve, reject) => {
        yauzl.open(filePath, {
            lazyEntries: true,
            decodeStrings: true,
            strictFileNames: true,
            validateEntrySizes: true
        }, (error, zipFile) => error ? reject(error) : resolve(zipFile));
    });
}

function entryType(entry) {
    const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
    return unixMode & 0o170000;
}

function validateEntry(entry, destination, limits, totals) {
    const isDirectory = /\/$/.test(entry.fileName);
    resolveWithin(destination, entry.fileName, { allowBase: isDirectory });

    const type = entryType(entry);
    if (type !== 0 && type !== 0o100000 && type !== 0o040000) {
        throw new Error(`Archive entry is a link or special file: ${entry.fileName}`);
    }

    totals.entries += 1;
    totals.expandedBytes += entry.uncompressedSize;
    if (totals.entries > limits.maxEntries) {
        throw new Error(`Archive contains more than ${limits.maxEntries} entries`);
    }
    if (totals.expandedBytes > limits.maxExpandedBytes) {
        throw new Error(`Archive expands beyond ${limits.maxExpandedBytes} bytes`);
    }

    if (entry.uncompressedSize > 0) {
        if (entry.compressedSize === 0 || entry.uncompressedSize / entry.compressedSize > limits.maxCompressionRatio) {
            throw new Error(`Archive entry exceeds compression ratio limit: ${entry.fileName}`);
        }
    }

    return { isDirectory };
}

async function inspectZip(filePath, destination, options = {}) {
    const limits = { ...DEFAULT_LIMITS, ...options };
    const totals = { entries: 0, expandedBytes: 0 };
    const zipFile = await openZip(filePath);

    return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (error) => {
            if (settled) return;
            settled = true;
            zipFile.close();
            reject(error);
        };

        zipFile.on('error', fail);
        zipFile.on('entry', (entry) => {
            try {
                validateEntry(entry, destination, limits, totals);
                zipFile.readEntry();
            } catch (error) {
                fail(error);
            }
        });
        zipFile.on('end', () => {
            if (settled) return;
            settled = true;
            resolve(totals);
        });
        zipFile.readEntry();
    });
}

async function extractZipSafely(filePath, destination, options = {}) {
    const limits = { ...DEFAULT_LIMITS, ...options };
    await inspectZip(filePath, destination, limits);
    await fs.promises.mkdir(destination, { recursive: true });
    const zipFile = await openZip(filePath);

    return new Promise((resolve, reject) => {
        const totals = { entries: 0, expandedBytes: 0 };
        let settled = false;
        const fail = (error) => {
            if (settled) return;
            settled = true;
            zipFile.close();
            reject(error);
        };

        zipFile.on('error', fail);
        zipFile.on('entry', (entry) => {
            let target;
            let details;
            try {
                details = validateEntry(entry, destination, limits, totals);
                target = resolveWithin(destination, entry.fileName, { allowBase: details.isDirectory });
            } catch (error) {
                fail(error);
                return;
            }

            if (details.isDirectory) {
                fs.promises.mkdir(target, { recursive: true }).then(() => zipFile.readEntry(), fail);
                return;
            }

            fs.promises.mkdir(path.dirname(target), { recursive: true }).then(() => {
                zipFile.openReadStream(entry, (error, readStream) => {
                    if (error) return fail(error);
                    const writeStream = fs.createWriteStream(target, { flags: 'wx', mode: 0o600 });
                    readStream.on('error', fail);
                    writeStream.on('error', fail);
                    writeStream.on('close', () => zipFile.readEntry());
                    readStream.pipe(writeStream);
                });
            }, fail);
        });
        zipFile.on('end', () => {
            if (settled) return;
            settled = true;
            resolve(totals);
        });
        zipFile.readEntry();
    });
}

module.exports = {
    DEFAULT_LIMITS,
    extractZipSafely,
    inspectZip
};
