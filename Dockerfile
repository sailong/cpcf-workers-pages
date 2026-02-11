# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM node:20-slim AS frontend-builder

# 【关键】全局设置淘宝源
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

WORKDIR /app

# Copy Frontend Dependencies
COPY manager/client/package.json ./manager/client/
COPY manager/client/package-lock.json* ./manager/client/

# Install Frontend Dependencies
WORKDIR /app/manager/client
# 使用 --no-audit 加快速度
RUN npm install --no-audit --no-fund

# Copy Frontend Source
COPY manager/client ./

# Build Frontend (outputs to dist/)
RUN npm run build


# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:20-slim

# 【核心修复区】解决卡死问题的三大法宝
# 1. CI=true: 告诉工具这是自动构建，绝对不要弹出交互式问答
# 2. WRANGLER_SEND_METRICS=false: 显式禁止 Wrangler 发送统计
# 3. 配置 npm 淘宝源
ENV CI=true \
    WRANGLER_SEND_METRICS=false \
    NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
    PHANTOMJS_CDNURL=https://npmmirror.com/mirrors/phantomjs/

# Install system dependencies
# 更新 ca-certificates 防止 SSL 报错，安装编译工具
# psmisc 用于 fuser 命令 (端口管理)
RUN apt-get update && \
    apt-get install -y ca-certificates python3 build-essential psmisc && \
    rm -rf /var/lib/apt/lists/*

# 【优化】使用 Yarn 安装 Wrangler (生产环境构建更稳定)
RUN corepack enable && \
    yarn config set registry https://registry.npmmirror.com && \
    yarn global add wrangler

WORKDIR /app

# Copy Backend Dependencies first for caching
COPY manager/package.json manager/package-lock.json* ./manager/

# Install Backend Dependencies
WORKDIR /app/manager
# 后端依赖
RUN npm install --production --registry=https://registry.npmmirror.com

# Copy Backend Code (server.js, utils/, etc.)
COPY manager/ ./

# Copy Built Frontend from Stage 1 to Backend's client/dist folder
# The server.js serves files from 'client/dist' relative to __dirname
COPY --from=frontend-builder /app/manager/client/dist ./client/dist

# Expose ports
# 8001: Manager UI & API
# 9100: R2 Admin Service
EXPOSE 8001
EXPOSE 9100

# Environment Variables
ENV NODE_ENV=production
ENV MANAGER_SERVICE_PORT=8001


# Start command
CMD ["node", "server.js"]