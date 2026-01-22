FROM node:20-slim

# Install utilities and build tools
# python3 and build-essential are often needed for node-gyp if we use native modules (e.g. for sqlite3 or pty)
RUN apt-get update && apt-get install -y git curl python3 build-essential && rm -rf /var/lib/apt/lists/*

# Install wrangler globally
RUN npm install -g wrangler

# Create app directory
WORKDIR /app

# Expose ports
# 3000: Platform Manager Web UI & API
# 8000-8020: Reserved for User Worker/Pages Projects
EXPOSE 3000
EXPOSE 8000-8020

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Default command starts the manager service
# We assume the manager source code is mounted or copied to /app/manager
CMD ["node", "manager/server.js"]
