#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

pass() {
    echo "PASS: $*"
}

warn() {
    echo "WARN: $*"
}

if [[ ! -f .env ]]; then
    fail ".env is required for public deployment"
fi

# shellcheck disable=SC1091
set -a
source .env
set +a
export CCFWP_DATA_DIR="${CCFWP_DATA_DIR:-/opt/1panel/apps/ccfwp/data}"

required_vars=(AUTH_PASSWORD INGRESS_PROXY_TOKEN CCFWP_UPDATER_TOKEN CCFWP_GITHUB_REPOSITORY CCFWP_IMAGE_REPOSITORY CCFWP_IMAGE_TAG CONSOLE_HOST PROJECTS_BASE_DOMAIN ACME_EMAIL CLOUDFLARE_API_TOKEN)
for key in "${required_vars[@]}"; do
    if [[ -z "${!key:-}" ]]; then
        fail "missing required environment variable: $key"
    fi
done
pass "required environment variables are present"

if [[ "${RUNTIME_PROVIDER:-docker}" != "docker" ]]; then
    fail "public deployment must use RUNTIME_PROVIDER=docker"
fi
pass "runtime provider is docker"

if [[ "${AUTH_PASSWORD}" == "admin" || "${AUTH_PASSWORD}" == "password" || "${#AUTH_PASSWORD}" -lt 12 ]]; then
    fail "AUTH_PASSWORD is too weak for public deployment"
fi
pass "AUTH_PASSWORD length/strength baseline checks passed"

if [[ "${#CCFWP_UPDATER_TOKEN}" -lt 32 || "$CCFWP_UPDATER_TOKEN" == "$INGRESS_PROXY_TOKEN" ]]; then
    fail "CCFWP_UPDATER_TOKEN must be an independent secret of at least 32 characters"
fi
[[ "$CCFWP_GITHUB_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "CCFWP_GITHUB_REPOSITORY must be owner/name"
pass "signed application release configuration is present"

[[ "${CCFWP_IMAGE_TAG}" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] \
    || fail "CCFWP_IMAGE_TAG must be a strict SemVer tag such as v1.2.4"
[[ "${CCFWP_DATA_DIR}" == /* && "${CCFWP_DATA_DIR}" != "/" ]] \
    || fail "CCFWP_DATA_DIR must be a non-root absolute host path"
pass "remote image tag and persistent host data path are valid"

if docker compose config >/dev/null 2>&1; then
    compose_config="$(docker compose config)"
else
    fail "docker compose config failed; ensure Docker Compose is available"
fi

echo "$compose_config" | rg -q 'published: "80"|published: 80|target: 80' || fail "port 80 is not published by compose"
echo "$compose_config" | rg -q 'published: "443"|published: 443|target: 443' || fail "port 443 is not published by compose"
if echo "$compose_config" | rg -q 'published: "?8001"?|target: 8001'; then
    # expose without host publish is fine; reject host publish of manager
    if echo "$compose_config" | rg -n 'published: "?8001"?' >/dev/null; then
        fail "manager port 8001 must not be published publicly"
    fi
fi
if echo "$compose_config" | rg -q 'published: "?9200"?|published: "?9100"?'; then
    fail "resource gateway/debug ports must not be published publicly"
fi
pass "compose publishes only public ingress ports"
if echo "$compose_config" | rg -q '^    build:'; then
    fail "production compose must pull a remote image and must not build on the server"
fi
if echo "$compose_config" | rg -q 'Caddyfile:ro'; then
    fail "production compose must use the Caddyfile embedded in the image"
fi
pass "production compose is remote-image and source-tree independent"

if [[ -f Caddyfile ]]; then
    rg -q 'reverse_proxy' Caddyfile || fail "Caddyfile is missing reverse_proxy"
    pass "Caddyfile is present"
else
    fail "Caddyfile is missing"
fi

build_network_mode="${BUILD_NETWORK_MODE:-prefer-offline}"
case "$build_network_mode" in
    online|prefer-offline|offline)
        pass "BUILD_NETWORK_MODE=$build_network_mode"
        ;;
    *)
        fail "BUILD_NETWORK_MODE must be online, prefer-offline, or offline"
        ;;
esac

if [[ -z "${BUILD_REGISTRY_ALLOWLIST:-}" ]]; then
    fail "BUILD_REGISTRY_ALLOWLIST must list at least one trusted registry"
fi
pass "BUILD_REGISTRY_ALLOWLIST is configured"

echo
echo "Public preflight completed. Remaining manual checks:"
echo "  1. DNS A/AAAA for CONSOLE_HOST and *.$PROJECTS_BASE_DOMAIN"
echo "  2. Cloudflare API token can create DNS-01 challenges"
echo "  3. Only 80/443 are reachable from the public internet"
echo "  4. Default admin password is rotated after first login"
echo "  5. BUILD_REGISTRY_ALLOWLIST only includes trusted registries"
echo "  6. GitHub release workflow runs on the exact SemVer tag"
