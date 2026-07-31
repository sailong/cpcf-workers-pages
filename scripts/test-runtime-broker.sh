#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${PROJECT_RUNTIME_IMAGE:-ccfwp-platform:broker-test}"
CONTAINER="ccfwp-broker-test-$$"
FIXTURE_DIR="$(mktemp -d /tmp/ccfwp-broker-test.XXXXXX)"

cleanup() {
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    for project_id in broker-integration-a broker-integration-b; do
        while IFS= read -r container_id; do
            [ -z "$container_id" ] || docker rm -f "$container_id" >/dev/null 2>&1 || true
        done < <(docker ps -aq \
            --filter label=io.ccfwp.runtime=true \
            --filter label=io.ccfwp.project-id="$project_id")
        while IFS= read -r network_id; do
            [ -z "$network_id" ] || docker network rm "$network_id" >/dev/null 2>&1 || true
        done < <(docker network ls -q \
            --filter label=io.ccfwp.runtime=true \
            --filter label=io.ccfwp.project-id="$project_id")
    done
    rm -rf "$FIXTURE_DIR"
}
trap cleanup EXIT

chmod 0755 "$FIXTURE_DIR"
docker build -t "$IMAGE" "$ROOT_DIR"
docker run -d --name "$CONTAINER" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$FIXTURE_DIR:$FIXTURE_DIR" \
    -v "$ROOT_DIR/manager/tests:/app/manager/tests:ro" \
    -e NODE_ENV=test \
    -e RUNTIME_PROVIDER=docker \
    -e PROJECT_RUNTIME_IMAGE="$IMAGE" \
    -e MANAGER_CONTAINER_ID="$CONTAINER" \
    -e PLATFORM_DATA_DIR="$FIXTURE_DIR" \
    -e PLATFORM_DATA_HOST_DIR="$FIXTURE_DIR" \
    -e RUN_DOCKER_INTEGRATION=1 \
    -e AUTH_PASSWORD=broker-secret-must-not-leak \
    "$IMAGE" sleep infinity >/dev/null

docker exec "$CONTAINER" node tests/verify_runtime_broker.js
