# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM node:20-slim AS frontend-builder

# 【Config】Use Aliyun Mirror for System Packages (Debian Bookworm)
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 【Config】Global Settings for pnpm and npm mirror
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    PNPM_HOME="/root/.local/share/pnpm" \
    ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
    PHANTOMJS_CDNURL=https://npmmirror.com/mirrors/phantomjs/

ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# Copy Frontend Dependencies and Source
# We copy everything including node_modules if they exist locally
COPY manager/client ./manager/client

# Install/Rebuild Frontend Dependencies
# Install Dependencies
WORKDIR /app/manager/client
RUN npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install --no-frozen-lockfile

# Build Frontend (outputs to dist/)
RUN pnpm run build


# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:20-slim

# 【Config】Env Vars
ENV CI=true \
    WRANGLER_SEND_METRICS=false \
    NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    PNPM_HOME="/root/.local/share/pnpm" \
    # Force build from source for better-sqlite3 if binaries fail, or use mirror
    # npm_config_better_sqlite3_binary_host=https://github.com/WiseLibs/better-sqlite3/releases/download/
    # Actually, let's try to build to be safe with arch mismatch
    PYTHON=/usr/bin/python3

ENV PATH="$PNPM_HOME:$PATH"

# 【Config】System Dependencies with Aliyun Mirror
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y ca-certificates python3 build-essential psmisc && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm add -g wrangler && \
    npm cache clean --force

WORKDIR /app

# Copy Backend Code AND node_modules
COPY manager/ ./manager/

# Install Backend Dependencies
WORKDIR /app/manager
# We need to rebuild better-sqlite3 specifically because it's native and arch-dependent
# If copying from Mac -> Linux, the binary will be wrong.
# Use npm instead of pnpm for better native module support
RUN npm install --omit=dev --registry=https://registry.npmmirror.com

# Copy Built Frontend from Stage 1
COPY --from=frontend-builder /app/manager/client/dist ./client/dist

# Expose ports
EXPOSE 8001
EXPOSE 9100

# Environment Variables
ENV NODE_ENV=production
ENV MANAGER_SERVICE_PORT=8001

# Start command
CMD ["node", "server.js"]