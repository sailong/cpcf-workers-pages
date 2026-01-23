FROM node:20-slim

# Install utilities and build tools
# python3 and build-essential are often needed for node-gyp if we use native modules (e.g. for sqlite3 or pty)
# psmisc is needed for 'fuser' command to kill processes by port
RUN apt-get update && apt-get install -y git curl python3 build-essential psmisc && rm -rf /var/lib/apt/lists/*

# Install wrangler globally
# Switch to yarn which is often more robust with network issues in Docker
RUN corepack enable && \
  yarn config set registry https://registry.npmmirror.com && \
  yarn global add wrangler

# Create app directory
WORKDIR /app

# Expose ports
# 8001: Platform Manager Web UI & API
EXPOSE 8001
EXPOSE 9100

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8001/ || exit 1

# Default command starts the manager service
# We assume the manager source code is mounted or copied to /app/manager
CMD ["node", "manager/server.js"]
