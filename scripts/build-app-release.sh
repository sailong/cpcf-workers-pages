#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-}"
ARCH="${2:-}"
OUTPUT_DIR="${3:-$ROOT_DIR/dist/releases}"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
[[ "$VERSION" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || fail "version must use the stable vX.Y.Z format"
[[ "$ARCH" == "amd64" || "$ARCH" == "arm64" ]] || fail "architecture must be amd64 or arm64"
command -v docker >/dev/null || fail "docker is required"
command -v zstd >/dev/null || fail "zstd is required"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
mkdir -p "$WORK_DIR/package/manager" "$OUTPUT_DIR"

rsync -a \
    --exclude node_modules \
    --exclude client/dist \
    --exclude client/node_modules \
    --exclude tests \
    "$ROOT_DIR/manager/" "$WORK_DIR/package/manager/"

docker run --rm \
    --volume "$WORK_DIR/package:/workspace" \
    --workdir /workspace/manager/client \
    node:22-bookworm \
    sh -ceu 'npm ci --no-audit --no-fund; npm run build; rm -rf node_modules'

# Backend dependencies can contain native binaries. Install them inside the
# target architecture while reusing the architecture-independent frontend build.
docker run --rm --platform "linux/$ARCH" \
    --volume "$WORK_DIR/package:/workspace" \
    --workdir /workspace/manager \
    node:22-bookworm \
    sh -ceu 'npm ci --omit=dev --ignore-scripts=false --no-audit --no-fund'

printf '{"version":"%s","gitSha":"%s"}\n' "$VERSION" "${GITHUB_SHA:-$(git -C "$ROOT_DIR" rev-parse HEAD)}" \
    > "$WORK_DIR/package/manager/app-version.json"

BUNDLE="$OUTPUT_DIR/ccfwp-app-$VERSION-linux-$ARCH.tar.zst"
tar --zstd -C "$WORK_DIR/package" -cf "$BUNDLE" manager
printf '%s\n' "$BUNDLE"
