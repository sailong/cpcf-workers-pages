#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.test.yml"
PROJECT_NAME=ccfwp-test
# Keep the path Docker-bind-mountable on macOS; nested runtime containers bind
# the same host path independently from the manager container.
TEST_DATA_DIR=$(mktemp -d "${CCFWP_E2E_TMPDIR:-/tmp}/ccfwp-e2e-data.XXXXXX")
# Docker Runtime containers bind-mount release files from this host path.
# Docker Desktop requires the mount root to be traversable by the runtime UID.
chmod 755 "$TEST_DATA_DIR"
export CCFWP_TEST_DATA_DIR="$TEST_DATA_DIR"

if [ -z "${CCFWP_TEST_PASSWORD:-}" ]; then
    CCFWP_TEST_PASSWORD="E2E-a$(node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('hex'))")"
    export CCFWP_TEST_PASSWORD
fi
if [ -z "${CCFWP_TEST_CAPTCHA:-}" ]; then
    CCFWP_TEST_CAPTCHA=$(node -e "process.stdout.write(require('node:crypto').randomBytes(16).toString('hex'))")
    export CCFWP_TEST_CAPTCHA
fi

cleanup() {
    status=$?
    if [ "$status" -ne 0 ]; then
        docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" logs --no-color || true
    fi
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down -v --remove-orphans
    rm -rf "$TEST_DATA_DIR"
    return "$status"
}
trap cleanup EXIT INT TERM

docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up --build -d --wait --wait-timeout 120
cd "$ROOT_DIR/tests/e2e"
PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:18001} \
PLAYWRIGHT_HTML_OPEN=never npm test -- "$@"
