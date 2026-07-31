# ==========================================
# Stage 0: Build Caddy with the Cloudflare DNS plugin
# ==========================================
FROM caddy:2.10.0-builder AS caddy-builder

RUN xcaddy build --with github.com/caddy-dns/cloudflare@v0.2.1

FROM gcr.io/projectsigstore/cosign:v2.5.0 AS cosign


# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM node:22-slim AS frontend-builder

# 【Config】Use Aliyun Mirror for System Packages (Debian Bookworm)
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 【Config】Global Settings for pnpm and npm mirror
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
    PHANTOMJS_CDNURL=https://npmmirror.com/mirrors/phantomjs/

WORKDIR /app

# Copy Frontend Dependencies and Source
# We copy everything including node_modules if they exist locally
COPY manager/client ./manager/client

# Install/Rebuild Frontend Dependencies
# Install Dependencies
WORKDIR /app/manager/client
RUN npm ci --registry=https://registry.npmmirror.com

# Build Frontend (outputs to dist/)
RUN npm run build


# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:22-slim

ARG CCFWP_BUILTIN_VERSION=v1.0.0

# 【Config】Env Vars
ENV CI=true \
    WRANGLER_SEND_METRICS=false \
    NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    # Force build from source for better-sqlite3 if binaries fail, or use mirror
    # npm_config_better_sqlite3_binary_host=https://github.com/WiseLibs/better-sqlite3/releases/download/
    # Actually, let's try to build to be safe with arch mismatch
    PYTHON=/usr/bin/python3

# 【Config】System Dependencies with Aliyun Mirror
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y ca-certificates python3 build-essential gzip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Backend Code AND node_modules
COPY manager/ ./manager/

# Install Backend Dependencies
WORKDIR /app/manager
# We need to rebuild better-sqlite3 specifically because it's native and arch-dependent
# If copying from Mac -> Linux, the binary will be wrong.
# Use npm instead of pnpm for better native module support
RUN npm ci --omit=dev --registry=https://registry.npmmirror.com

# Copy Built Frontend from Stage 1
COPY --from=frontend-builder /app/manager/client/dist ./client/dist

# The production Compose stack runs Caddy from this same image.
COPY --from=caddy-builder /usr/bin/caddy /usr/local/bin/caddy
COPY --from=cosign /ko-app/cosign /usr/local/bin/cosign

# The image is the stable runtime. Application releases are seeded from this
# snapshot and later switched through the persistent release volume.
RUN mkdir -p /opt/ccfwp-builtin && cp -a /app/manager /opt/ccfwp-builtin/manager
COPY updater/ /app/updater/

# Expose ports
EXPOSE 8001 80 443 443/udp

# Environment Variables
ENV NODE_ENV=production
ENV MANAGER_SERVICE_PORT=8001
ENV CCFWP_BUILTIN_VERSION=${CCFWP_BUILTIN_VERSION}

# Start command
CMD ["node", "/app/updater/entrypoint.js"]
