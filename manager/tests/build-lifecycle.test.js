'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBuildArtifactService } = require('../services/build-artifact-service');
const { safeShellExec, validateCommand } = require('../utils/safe-exec');
const { createTempFileCleaner } = require('../utils/sse-helper');

function fixture() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-build-lifecycle-'));
}

test('expired build artifacts are removed without touching active or fresh workspaces', () => {
    const root = fixture();
    const clock = new Date('2026-01-02T00:00:00.000Z');
    const service = createBuildArtifactService({ root, ttlMs: 60_000, now: () => clock });
    const expiredId = 'build-00000000-0000-4000-8000-000000000001';
    const activeId = 'build-00000000-0000-4000-8000-000000000002';
    const freshId = 'build-00000000-0000-4000-8000-000000000003';

    try {
        const active = service.begin(activeId);
        fs.mkdirSync(active, { recursive: true });
        const expired = path.join(root, expiredId);
        const fresh = path.join(root, freshId);
        fs.mkdirSync(expired, { recursive: true });
        fs.mkdirSync(fresh, { recursive: true });
        const old = new Date(clock.getTime() - 120_000);
        fs.utimesSync(expired, old, old);
        fs.utimesSync(active, old, old);

        assert.deepEqual(service.cleanupExpired(), [expiredId]);
        assert.equal(fs.existsSync(expired), false);
        assert.equal(fs.existsSync(active), true);
        assert.equal(fs.existsSync(fresh), true);

        service.discard(activeId);
        assert.equal(fs.existsSync(active), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('retained build artifacts receive a fresh expiry timestamp', () => {
    const root = fixture();
    const clock = new Date('2026-01-02T00:00:00.000Z');
    const service = createBuildArtifactService({ root, ttlMs: 60_000, now: () => clock });
    const buildId = 'build-00000000-0000-4000-8000-000000000004';

    try {
        const workspace = service.begin(buildId);
        fs.mkdirSync(workspace, { recursive: true });
        service.retain(buildId);
        assert.equal(fs.statSync(workspace).mtimeMs, clock.getTime());
        assert.deepEqual(service.cleanupExpired(), []);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('aborting a process build terminates it and rejects promptly', async () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        private: true,
        scripts: { hold: 'node -e "setInterval(() => {}, 1000)"' }
    }));
    const controller = new AbortController();
    const startedAt = Date.now();

    try {
        const build = safeShellExec('npm run hold', {
            cwd: root,
            timeout: 10_000,
            signal: controller.signal
        });
        setTimeout(() => controller.abort(), 100);
        await assert.rejects(build, error => error.name === 'AbortError' && /cancelled/i.test(error.message));
        assert.ok(Date.now() - startedAt < 2_000);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('process build commands preserve quoted arguments without invoking a shell', () => {
    const validation = validateCommand('npm run build -- --message "hello world"');
    assert.equal(validation.valid, true);
    assert.equal(validation.file, 'npm');
    assert.deepEqual(validation.args, ['run', 'build', '--', '--message', 'hello world']);
    const source = fs.readFileSync(path.join(__dirname, '../utils/safe-exec.js'), 'utf8');
    assert.doesNotMatch(source, /shell:\s*true/);
});

test('process builds execute only validated top-level && steps with a shared timeout', async () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        private: true,
        scripts: {
            first: 'node -e "require(\'fs\').writeFileSync(\'first.txt\', \'ok\')"',
            second: 'node -e "require(\'fs\').writeFileSync(\'second.txt\', \'ok\')"'
        }
    }));

    try {
        assert.equal(validateCommand('npm run first && npm run second').valid, true);
        await safeShellExec('npm run first && npm run second', { cwd: root, timeout: 10_000 });
        assert.equal(fs.readFileSync(path.join(root, 'first.txt'), 'utf8'), 'ok');
        assert.equal(fs.readFileSync(path.join(root, 'second.txt'), 'utf8'), 'ok');

        for (const command of [
            'npm run first; npm run second',
            'npm run first || npm run second',
            'npm run first | npm run second',
            'npm run first & npm run second',
            'npm run first &&'
        ]) {
            assert.equal(validateCommand(command).valid, false, command);
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('temporary cleaner unregisters process handlers after cleanup', async () => {
    const root = fixture();
    const target = path.join(root, 'temporary.txt');
    fs.writeFileSync(target, 'temporary');
    const before = process.listenerCount('SIGTERM');
    const cleaner = createTempFileCleaner([target]);
    assert.equal(process.listenerCount('SIGTERM'), before + 1);

    await cleaner.cleanup();
    assert.equal(process.listenerCount('SIGTERM'), before);
    assert.equal(fs.existsSync(target), false);
    fs.rmSync(root, { recursive: true, force: true });
});
