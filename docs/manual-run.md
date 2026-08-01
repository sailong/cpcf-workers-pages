
# 手动运行说明（仅限本机调试）

本指南只用于本机调试和故障定位。直接在主机上运行 Node.js 不提供生产所需的项目隔离、Caddy
自动 TLS 或公网入口；生产环境必须使用 `docker-compose.yml`。公网部署请参阅[部署指南](deployment.md)。

## 前置要求 (Prerequisites)

*   **Node.js**: v22.0.0 或更高版本
*   **npm**: 生成环境通常自带
*   **Linux/macOS**: 建议环境 (Windows 可能需要 WSL)

## 1. 准备项目文件

确保您已经完整下载了项目代码。项目的核心目录结构如下：

```
/workers-pages-d1sql-workerskv
  ├── manager/           # 核心代码
  │   ├── client/        # 前端界面 (React + Vite)
  │   ├── server.js      # 后端入口
  │   └── ...
  ├── docs/              # 文档与部署配置
  ├── Dockerfile         # 生产环境构建文件
  └── .platform-data/    # [重要] 数据存储目录 (运行时自动生成)
```

## 2. 安装依赖 (Install Dependencies)

您需要分别安装后端和前端的依赖。仓库包含锁文件时使用 `npm ci`，不要使用未锁定版本的 `npm install`。

### 2.1 安装后端依赖
在 `manager` 目录下运行：
```bash
cd manager
npm ci
```

### 2.2 安装前端依赖并构建

进入前端目录并构建：
```bash
cd manager/client
npm ci
npm run build
```
> **重要说明**：后端服务 (`server.js`) 会自动托管 `manager/client/dist` 目录中的静态文件。**必须**先执行 `npm run build` 生成此目录，否则访问首页会出现 404 错误。

## 3. 环境变量配置 (Environment Variables)

您可以直接在命令行设置环境变量，或创建一个 `.env` 文件（如果您想持久化配置）。
以下是主要的环境变量：

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `MANAGER_SERVICE_PORT` | `3000` | 后端服务监听端口 |
| `RUNTIME_PROVIDER` | `docker` | 隔离运行时；默认 Docker。`process` 仅用于非隔离调试 |
| `ALLOW_UNISOLATED_RUNTIME` | 未设置 | 必须设为 `true` 才能启用 `RUNTIME_PROVIDER=process`；公网禁止 |
| `BUILD_NETWORK_MODE` | `prefer-offline` | 构建安装网络策略：`online` / `prefer-offline` / `offline` |
| `BUILD_REGISTRY_ALLOWLIST` | npm 官方与 npmmirror | 允许访问的 npm registry 列表 |
| `BUILD_DEFAULT_REGISTRY` | `https://registry.npmmirror.com/` | 非白名单 registry 会被替换为该值 |
| `AUTH_PASSWORD` | 开发默认密码 | 初次启动管理员密码；已有数据目录不会被环境变量覆盖 |


## 4. 启动服务 (Start Server)

回到 `manager` 目录，启动后端服务。满足项目隔离要求时必须使用 Docker Runtime Broker；直接运行 Node 只适合明确接受非隔离风险的调试场景。

### 方式 A：直接启动 (开发/调试)

您可以自由选择以下两种配置方式：

**1. 使用 .env 文件 (推荐)**
在 `manager` 目录下创建一个名为 `.env` 的文件，填入以下内容：
```bash
MANAGER_SERVICE_PORT=8001
RUNTIME_PROVIDER=docker
BUILD_NETWORK_MODE=prefer-offline
BUILD_REGISTRY_ALLOWLIST=https://registry.npmmirror.com/,https://registry.npmjs.org/
BUILD_DEFAULT_REGISTRY=https://registry.npmmirror.com/
```
然后直接运行：
```bash
node server.js
```

> **注意**：此处创建的 `.env` 文件**不会影响** Docker 运行环境。
> 项目的 `.dockerignore` 已配置排除 `.env`，因此 Docker 容器会始终使用 `docker-compose.yml` 中的配置，两者互不干扰。

**2. 使用 命令行变量**

**Linux / macOS / Git Bash:**
```bash
export MANAGER_SERVICE_PORT=8001
node server.js
```

**Windows (CMD):**
```cmd
set MANAGER_SERVICE_PORT=8001
node server.js
```

**Windows (PowerShell):**
```powershell
$env:MANAGER_SERVICE_PORT="8001"
node server.js
```

### 不支持的用法

本文件不提供 PM2、公网反向代理或生产进程部署方案。即使使用 `RUNTIME_PROVIDER=docker`，直接
运行 Node.js 也缺少 Compose 中的 Caddy、升级器和生产入口配置；请使用[生产部署流程](deployment.md)。

## 5. 访问应用

启动成功后，打开浏览器访问：

*   **管理面板**: `http://localhost:8001` (或您配置的端口)


## 6. 数据备份

所有数据（数据库、上传的文件、配置文件）都存储在项目根目录下的 `.platform-data/` 文件夹中。
**请务必定期备份该目录。**
