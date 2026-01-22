# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app

# Copy Frontend Dependencies
COPY manager/client/package.json ./manager/client/
# Copy lock file if exists
COPY manager/client/package-lock.json* ./manager/client/

# Install Frontend Dependencies
WORKDIR /app/manager/client
RUN npm install

# Copy Frontend Source
COPY manager/client ./

# Build Frontend (outputs to dist/)
RUN npm run build


# Stage 2: Production Runtime
FROM node:20-slim

# Install system dependencies
# python3 and build-essential are required for building native modules like better-sqlite3 or pty.js
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*

# Install Wrangler globally
RUN npm install -g wrangler

WORKDIR /app

# Copy Backend Dependencies first for caching
COPY manager/package.json manager/package-lock.json* ./manager/

# Install Backend Dependencies
WORKDIR /app/manager
RUN npm install --production

# Copy Backend Code (server.js, utils/, etc.)
COPY manager/ ./

# Copy Built Frontend from Stage 1 to Backend's client/dist folder
# The server.js serves files from 'client/dist' relative to __dirname
COPY --from=frontend-builder /app/manager/client/dist ./client/dist

# Expose ports
# 3000: Manager UI
# 8000-8020: Worker/Pages User Projects
EXPOSE 3000
EXPOSE 8000-8020

# Environment Variables
ENV NODE_ENV=production
ENV PORT=3000

# Start command
CMD ["node", "server.js"]
