'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yazl = require('yazl');
const { assertNoSymlinkWithin, resolveWithin } = require('../utils/path-helper');
const { extractZipSafely, inspectZip } = require('../utils/zip-helper');

async function createZip(entries) {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ccfwp-zip-fixture-'));
    const archive = path.join(directory, 'fixture.zip');
    const zip = new yazl.ZipFile();
    for (const entry of entries) {
        zip.addBuffer(Buffer.from(entry.content || 'content'), entry.name, entry.options || {});
    }
    zip.end();
    await new Promise((resolve, reject) => {
        zip.outputStream.pipe(fs.createWriteStream(archive)).on('close', resolve).on('error', reject);
    });
    return { archive, directory };
}

async function replaceZipName(archive, from, to) {
    assert.equal(Buffer.byteLength(from), Buffer.byteLength(to));
    const data = await fs.promises.readFile(archive);
    let offset = 0;
    let replacements = 0;
    while ((offset = data.indexOf(from, offset, 'utf8')) !== -1) {
        data.write(to, offset, 'utf8');
        offset += Buffer.byteLength(to);
        replacements += 1;
    }
    assert.ok(replacements >= 2);
    await fs.promises.writeFile(archive, data);
}

test('resolveWithin rejects traversal, absolute, encoded, and sibling-prefix paths', () => {
    const root = path.join(os.tmpdir(), 'allowed-root');
    assert.equal(resolveWithin(root, 'nested/file.txt'), path.join(root, 'nested/file.txt'));
    for (const value of ['../escape', '%2e%2e%2fescape', '%252e%252e%252fescape', '/etc/passwd', 'C:\\Windows\\win.ini', '../allowed-root-sibling/file']) {
        assert.throws(() => resolveWithin(root, value), /path|absolute|traversal|root|escape/i);
    }
});

test('project file paths reject symlink components', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ccfwp-path-fixture-'));
    const root = path.join(directory, 'project');
    const sibling = path.join(directory, 'sibling');
    await fs.promises.mkdir(root);
    await fs.promises.mkdir(sibling);
    await fs.promises.symlink(sibling, path.join(root, 'escape'));
    try {
        const target = resolveWithin(root, 'escape/secret.txt');
        assert.throws(() => assertNoSymlinkWithin(root, target), /symbolic link/i);
    } finally {
        await fs.promises.rm(directory, { recursive: true, force: true });
    }
});

test('ZIP preflight runs before extraction and rejects traversal entries', async () => {
    const fixture = await createZip([{ name: 'evil.txt' }]);
    const destination = path.join(fixture.directory, 'output');
    try {
        await replaceZipName(fixture.archive, 'evil.txt', '../a.txt');
        await assert.rejects(extractZipSafely(fixture.archive, destination), /path|invalid|relative|traversal/i);
        assert.equal(fs.existsSync(destination), false);
        assert.equal(fs.existsSync(path.join(fixture.directory, 'a.txt')), false);
    } finally {
        await fs.promises.rm(fixture.directory, { recursive: true, force: true });
    }
});

test('ZIP preflight rejects links, expanded-size excess, and compression bombs', async () => {
    const linkFixture = await createZip([{ name: 'link', options: { mode: 0o120777 } }]);
    const sizeFixture = await createZip([{ name: 'large.bin', content: Buffer.alloc(4096, 1) }]);
    try {
        await assert.rejects(inspectZip(linkFixture.archive, path.join(linkFixture.directory, 'out')), /link|special/i);
        await assert.rejects(inspectZip(sizeFixture.archive, path.join(sizeFixture.directory, 'out'), { maxExpandedBytes: 16 }), /expands/i);
        await assert.rejects(inspectZip(sizeFixture.archive, path.join(sizeFixture.directory, 'out'), { maxCompressionRatio: 2 }), /compression ratio/i);
    } finally {
        await fs.promises.rm(linkFixture.directory, { recursive: true, force: true });
        await fs.promises.rm(sizeFixture.directory, { recursive: true, force: true });
    }
});

test('safe ZIP extraction writes only validated regular files', async () => {
    const fixture = await createZip([{ name: 'nested/file.txt', content: 'ok' }]);
    const destination = path.join(fixture.directory, 'output');
    try {
        await extractZipSafely(fixture.archive, destination);
        assert.equal(await fs.promises.readFile(path.join(destination, 'nested/file.txt'), 'utf8'), 'ok');
    } finally {
        await fs.promises.rm(fixture.directory, { recursive: true, force: true });
    }
});
