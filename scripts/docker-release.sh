#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATE_FILE="${CCFWP_DEPLOY_STATE_FILE:-$ROOT_DIR/.ccfwp-image-state}"
PLATFORMS="${CCFWP_PLATFORMS:-linux/amd64,linux/arm64}"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

info() {
    echo "INFO: $*"
}

if [[ -n "${CCFWP_IMAGE_REPOSITORY:-}" ]]; then
    IMAGE_REPOSITORY="$CCFWP_IMAGE_REPOSITORY"
elif [[ -n "${DOCKERHUB_USERNAME:-}" ]]; then
    IMAGE_REPOSITORY="docker.io/${DOCKERHUB_USERNAME}/ccfwp-platform"
else
    IMAGE_REPOSITORY="ccfwp-platform"
fi

valid_tag() {
    [[ "$1" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]
}

require_tag() {
    local tag="$1"
    valid_tag "$tag" || fail "invalid Docker image tag: $tag"
}

state_value() {
    local key="$1"
    [[ -f "$STATE_FILE" ]] || return 0
    awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' "$STATE_FILE"
}

write_state() {
    local current="$1"
    local previous="$2"
    local temporary
    temporary="$(mktemp "${STATE_FILE}.XXXXXX")"
    printf 'current=%s\nprevious=%s\n' "$current" "$previous" > "$temporary"
    mv "$temporary" "$STATE_FILE"
}

current_container_tag() {
    local image_ref
    image_ref="$(docker inspect -f '{{.Config.Image}}' ccfwp-container 2>/dev/null || true)"
    [[ "$image_ref" == *:* ]] || return 0
    printf '%s\n' "${image_ref##*:}"
}

remembered_current_tag() {
    local remembered
    remembered="$(state_value current)"
    if [[ -n "$remembered" ]]; then
        printf '%s\n' "$remembered"
    else
        current_container_tag
    fi
}

publish() {
    local tag="$1"
    require_tag "$tag"
    [[ "$IMAGE_REPOSITORY" == */* ]] || fail "publishing requires CCFWP_IMAGE_REPOSITORY or DOCKERHUB_USERNAME"
    [[ -z "$(git status --porcelain)" ]] || fail "refusing to publish a dirty working tree; commit or stash changes first"

    info "Building and publishing ${IMAGE_REPOSITORY}:${tag} for ${PLATFORMS}"
    docker buildx build \
        --platform "$PLATFORMS" \
        --tag "${IMAGE_REPOSITORY}:${tag}" \
        --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
        --push \
        .
}

deploy() {
    local tag="$1"
    local previous
    require_tag "$tag"
    previous="$(remembered_current_tag)"
    [[ "$previous" != "$tag" ]] || info "Deploying the already active tag ${tag}"

    export CCFWP_IMAGE_REPOSITORY="$IMAGE_REPOSITORY"
    export CCFWP_IMAGE_TAG="$tag"
    info "Pulling ${IMAGE_REPOSITORY}:${tag}"
    docker compose pull ccfwp caddy
    info "Starting the platform and Caddy from ${IMAGE_REPOSITORY}:${tag}"
    docker compose up -d --no-build --wait --wait-timeout 180 ccfwp caddy
    docker compose ps
    write_state "$tag" "${previous:-none}"
    info "Deployment state saved to ${STATE_FILE}"
}

rollback() {
    local current previous
    current="$(state_value current)"
    previous="$(state_value previous)"
    [[ -n "$previous" && "$previous" != "none" ]] || fail "no previous image tag is recorded in ${STATE_FILE}"
    info "Rolling back from ${current:-unknown} to ${previous}"
    deploy "$previous"
}

usage() {
    cat <<'EOF'
Usage:
  scripts/docker-release.sh publish [tag]
  scripts/docker-release.sh deploy <tag>
  scripts/docker-release.sh rollback

Environment:
  DOCKERHUB_USERNAME          Docker Hub namespace used when no repository is set
  CCFWP_IMAGE_REPOSITORY      Full image repository, e.g. docker.io/acme/ccfwp-platform
  CCFWP_PLATFORMS             Buildx platforms (default: linux/amd64,linux/arm64)
  CCFWP_DEPLOY_STATE_FILE     Optional deployment state path override
EOF
}

action="${1:-}"
case "$action" in
    publish)
        publish "${2:-$(git rev-parse --short=12 HEAD)}"
        ;;
    deploy)
        [[ $# -eq 2 ]] || fail "deploy requires exactly one image tag"
        deploy "$2"
        ;;
    rollback)
        [[ $# -eq 1 ]] || fail "rollback does not accept arguments"
        rollback
        ;;
    *)
        usage
        exit 2
        ;;
esac
