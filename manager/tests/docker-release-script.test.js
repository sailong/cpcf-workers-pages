'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../scripts/docker-release.sh');

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
    printf '%s\\n' 'docker.io/example/ccfwp-platform:old-tag'
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
        const deploy = spawnSync(SCRIPT, ['deploy', 'new-tag'], { env, encoding: 'utf8' });
        assert.equal(deploy.status, 0, deploy.stderr);
        assert.equal(fs.readFileSync(stateFile, 'utf8'), 'current=new-tag\nprevious=old-tag\n');

        const calls = fs.readFileSync(callLog, 'utf8');
        assert.match(calls, /compose pull ccfwp caddy/);
        assert.match(calls, /compose up -d --no-build --wait --wait-timeout 180 ccfwp caddy/);

        const rollback = spawnSync(SCRIPT, ['rollback'], { env, encoding: 'utf8' });
        assert.equal(rollback.status, 0, rollback.stderr);
        assert.equal(fs.readFileSync(stateFile, 'utf8'), 'current=old-tag\nprevious=new-tag\n');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
