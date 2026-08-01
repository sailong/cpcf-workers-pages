#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$ROOT_DIR/manager"
npm test
npm run test:pages-runtime
npm audit --omit=dev --audit-level=high

cd "$ROOT_DIR/manager/client"
npm run test:coverage
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=high

cd "$ROOT_DIR"
docker compose --env-file .env.production.example -f docker-compose.yml config >/dev/null
docker compose --env-file .env.production.example -f docker-compose.1panel.yml config >/dev/null
docker compose --env-file .env.1panel.example -f docker-compose.1panel.yml config >/dev/null
docker compose --env-file .env.acme-staging.example -f docker-compose.yml config >/dev/null
docker compose -f docker-compose.dev.yml config >/dev/null
CCFWP_TEST_PASSWORD=ComposeValidationOnly CCFWP_TEST_CAPTCHA=ComposeValidationOnly \
    docker compose -f docker-compose.test.yml config >/dev/null

echo "All non-browser quality gates passed."
