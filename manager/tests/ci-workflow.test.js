'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateE2EEnvironment } = require('../../scripts/generate-e2e-env');

const ROOT = path.resolve(__dirname, '../..');

test('CI credential generation writes bounded random values without shell interpolation', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-ci-env-'));
    const outputFile = path.join(directory, 'github-env');
    const dataDir = path.join(directory, 'data');
    try {
        const generated = generateE2EEnvironment({
            outputFile,
            dataDir,
            randomBytes: size => Buffer.alloc(size, size === 24 ? 0xab : 0xcd)
        });
        assert.equal(generated.password, `E2E-a${'ab'.repeat(24)}`);
        assert.equal(generated.captcha, 'cd'.repeat(16));
        assert.equal(fs.existsSync(dataDir), true);
        assert.equal(fs.readFileSync(outputFile, 'utf8'), [
            `CCFWP_TEST_PASSWORD=${generated.password}`,
            `CCFWP_TEST_CAPTCHA=${generated.captcha}`,
            `CCFWP_TEST_DATA_DIR=${dataDir}`,
            ''
        ].join('\n'));
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('CI workflow keeps cleanup-safe defaults and invokes the credential generator', () => {
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    assert.match(workflow, /CCFWP_TEST_PASSWORD: E2E-Cleanup-Fallback-Only-123/);
    assert.doesNotMatch(workflow, /^ {6}CCFWP_TEST_DATA_DIR:/m);
    assert.match(workflow, /- name: Generate isolated test credentials\n {8}env:\n {10}CCFWP_TEST_DATA_DIR: \$\{\{ runner\.temp \}\}\/ccfwp-test-data\n {8}run: node scripts\/generate-e2e-env\.js/);
    assert.doesNotMatch(workflow, /node -e \\"/);
});

test('GitHub Actions only runs on SemVer tag pushes and gates release on CI', () => {
    const ciWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    const releaseWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/app-release.yml'), 'utf8');

    assert.match(ciWorkflow, /^on:\n {2}workflow_call:[ \t]*$/m);
    assert.doesNotMatch(ciWorkflow, /^ {2}(?:push|pull_request|workflow_dispatch):/m);
    assert.match(releaseWorkflow, /^on:\n {2}push:\n {4}tags:\n {6}- 'v\[0-9\]\+\.\[0-9\]\+\.\[0-9\]\+'$/m);
    assert.doesNotMatch(releaseWorkflow, /^ {2}(?:pull_request|workflow_dispatch):/m);
    assert.match(releaseWorkflow, /^ {2}ci:\n {4}uses: \.\/\.github\/workflows\/ci\.yml$/m);
    assert.match(releaseWorkflow, /^ {2}release:\n {4}needs: ci\n {4}permissions:\n {6}contents: write\n {6}id-token: write$/m);
    assert.doesNotMatch(releaseWorkflow, /^ {2}id-token: write$/m);
});

test('GitHub workflows use Node 24-based checkout and setup actions', () => {
    const workflows = ['ci.yml', 'app-release.yml']
        .map(file => fs.readFileSync(path.join(ROOT, '.github/workflows', file), 'utf8'))
        .join('\n');
    assert.doesNotMatch(workflows, /actions\/(?:checkout|setup-node)@v[1-6]\b/);
    assert.match(workflows, /actions\/checkout@v7/);
    assert.match(workflows, /actions\/setup-node@v7/);
});

test('application release containers write mounted files as the runner user', () => {
    const script = fs.readFileSync(path.join(ROOT, 'scripts/build-app-release.sh'), 'utf8');
    assert.match(script, /HOST_UID="\$\(id -u\)"/);
    assert.match(script, /HOST_GID="\$\(id -g\)"/);
    assert.equal((script.match(/--user "\$HOST_UID:\$HOST_GID"/g) || []).length, 2);
    assert.equal((script.match(/--env HOME=\/tmp\/ccfwp-home/g) || []).length, 2);
    assert.equal((script.match(/--env NPM_CONFIG_CACHE=\/tmp\/ccfwp-npm-cache/g) || []).length, 2);
});

test('application releases use tar.gz bundles from build through online extraction', () => {
    const buildScript = fs.readFileSync(path.join(ROOT, 'scripts/build-app-release.sh'), 'utf8');
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/app-release.yml'), 'utf8');
    const releaseClient = fs.readFileSync(path.join(ROOT, 'updater/release-client.js'), 'utf8');
    const updaterServer = fs.readFileSync(path.join(ROOT, 'updater/server.js'), 'utf8');
    const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
    const releaseSources = [buildScript, workflow, releaseClient, updaterServer, dockerfile].join('\n');

    assert.match(buildScript, /ccfwp-app-\$VERSION-linux-\$ARCH\.tar\.gz/);
    assert.match(buildScript, /tar -czf "\$BUNDLE" -C "\$WORK_DIR\/package" manager/);
    assert.match(workflow, /ccfwp-app-\$\{version\}-linux-\$\{arch\}\.tar\.gz/);
    assert.match(releaseClient, /ccfwp-app-\$\{tag\}-linux-\$\{arch\}\.tar\.gz/);
    assert.match(updaterServer, /\['-tzf', bundlePath\]/);
    assert.match(updaterServer, /\['-xzf', bundlePath, '-C', destination\]/);
    assert.match(dockerfile, /apt-get install -y ca-certificates python3 build-essential gzip/);
    assert.doesNotMatch(releaseSources, /tar\.zst|--zstd|\bzstd\b/i);
});
