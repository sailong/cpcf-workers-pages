'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../scripts/docker-release.sh');
const REPOSITORY_ROOT = path.resolve(__dirname, '../..');

test('Docker image publishing runs locally and pushes one strict multi-platform tag', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-docker-publish-'));
    const binDir = path.join(root, 'bin');
    const callLog = path.join(root, 'docker-calls.log');
    fs.mkdirSync(binDir);

    fs.writeFileSync(path.join(binDir, 'docker'), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$DOCKER_CALL_LOG"
`);
    fs.writeFileSync(path.join(binDir, 'git'), `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "status" ]]; then
    exit 0
fi
if [[ "\${1:-}" == "rev-parse" ]]; then
    printf '%s\\n' '0123456789abcdef0123456789abcdef01234567'
    exit 0
fi
exit 1
`);
    fs.chmodSync(path.join(binDir, 'docker'), 0o755);
    fs.chmodSync(path.join(binDir, 'git'), 0o755);

    const env = {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        DOCKER_CALL_LOG: callLog,
        CCFWP_IMAGE_REPOSITORY: 'docker.io/example/ccfwp-platform'
    };

    try {
        const publish = spawnSync(SCRIPT, ['publish', 'v1.2.3'], { env, encoding: 'utf8' });
        assert.equal(publish.status, 0, publish.stderr);
        assert.match(publish.stdout, /Building locally and pushing/);

        const calls = fs.readFileSync(callLog, 'utf8');
        assert.match(calls, /buildx build --platform linux\/amd64,linux\/arm64/);
        assert.match(calls, /--tag docker\.io\/example\/ccfwp-platform:v1\.2\.3/);
        assert.match(calls, /--build-arg CCFWP_BUILTIN_VERSION=v1\.2\.3/);
        assert.match(calls, /--label org\.opencontainers\.image\.revision=0123456789abcdef/);
        assert.match(calls, /--push \.$/m);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('GitHub Actions publishes application bundles but never Docker images', () => {
    const workflows = path.join(REPOSITORY_ROOT, '.github/workflows');
    assert.equal(fs.existsSync(path.join(workflows, 'docker-publish.yml')), false);

    const applicationRelease = fs.readFileSync(path.join(workflows, 'app-release.yml'), 'utf8');
    assert.match(applicationRelease, /build-app-release\.sh/);
    assert.match(applicationRelease, /cosign sign-blob/);
    assert.doesNotMatch(applicationRelease, /docker\/build-push-action|DOCKERHUB_|docker buildx/i);
});

test('Docker image deploy records the previous tag and rollback swaps it back', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfwp-docker-release-'));
    const binDir = path.join(root, 'bin');
    const stateFile = path.join(root, 'state');
    const callLog = path.join(root, 'docker-calls.log');
    fs.mkdirSync(binDir);
    const fakeDocker = path.join(binDir, 'docker');
    fs.writeFileSync(fakeDocker, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$DOCKER_CALL_LOG"
if [[ "\${1:-}" == "inspect" ]]; then
    printf '%s\\n' 'docker.io/example/ccfwp-platform:v1.0.0'
fi
`);
    fs.chmodSync(fakeDocker, 0o755);

    const env = {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        DOCKER_CALL_LOG: callLog,
        CCFWP_DEPLOY_STATE_FILE: stateFile,
        CCFWP_IMAGE_REPOSITORY: 'docker.io/example/ccfwp-platform'
    };

    try {
        const rejected = spawnSync(SCRIPT, ['deploy', 'latest'], { env, encoding: 'utf8' });
        assert.notEqual(rejected.status, 0);
        assert.match(rejected.stderr, /strict SemVer/);

        const deploy = spawnSync(SCRIPT, ['deploy', 'v1.1.0'], { env, encoding: 'utf8' });
        assert.equal(deploy.status, 0, deploy.stderr);
        assert.equal(fs.readFileSync(stateFile, 'utf8'), 'current=v1.1.0\nprevious=v1.0.0\n');

        const calls = fs.readFileSync(callLog, 'utf8');
        assert.match(calls, /compose pull ccfwp ccfwp-updater caddy/);
        assert.match(calls, /compose up -d --no-build --wait --wait-timeout 180 ccfwp-updater ccfwp caddy/);

        const rollback = spawnSync(SCRIPT, ['rollback'], { env, encoding: 'utf8' });
        assert.equal(rollback.status, 0, rollback.stderr);
        assert.equal(fs.readFileSync(stateFile, 'utf8'), 'current=v1.0.0\nprevious=v1.1.0\n');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
