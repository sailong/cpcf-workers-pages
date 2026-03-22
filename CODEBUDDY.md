# CODEBUDDY.md 本文件为 CodeBuddy 在此仓库中工作时提供指导。

## 项目概览

CCFWP (Cloudflare 本地平台) 是一个基于 Docker 的本地开发环境，模拟 Cloudflare 的 Workers 和 Pages 运行时。它提供 Web UI 来管理多个无服务器项目，支持 KV、D1 和 R2 资源。

## 常用命令

### 开发环境

```bash
# 启动整个平台（生产构建）
docker-compose up -d --build

# 开发模式（挂载本地源码，支持热重载）
docker-compose -f docker-compose.dev.yml up -d --build

# 访问管理界面 http://localhost:8001
# 默认密码：admin
```

### 前端开发

```bash
cd manager/client

# 安装依赖
pnpm install

# 启动开发服务器（热重载）
pnpm dev

# 生产构建
pnpm build

# 代码检查
pnpm lint

# 预览生产构建
pnpm preview
```

### 后端开发

```bash
cd manager

# 安装依赖
pnpm install

# 启动服务器（需要先构建前端到 client/dist）
node server.js

# 环境变量（可选）：
# MANAGER_SERVICE_PORT - 管理服务端口（默认：3000）
# R2_ADMIN_PORT - R2 管理服务端口（默认：9100）
```

### 测试

```bash
# 运行后端测试
cd manager
node tests/test-runner.js

# 通过 API 端点手动测试
# 所有 API 路由在 /api/* 下
# 大部分端点需要认证（JWT token）
```

## 架构说明

### 核心组件

**后端 (Express + Node.js)**
- 入口文件：`manager/server.js`
- API 路由在 `manager/routes/` 处理项目、资源（KV/D1/R2）、认证和文件管理
- 业务逻辑在 `manager/services/`：`project-service.js`（CRUD）、`runtime-service.js`（进程编排）、`resource-service.js`（KV/D1/R2）、`auth-service.js`（JWT + 验证码）
- 中间件：`auth.js`（JWT 验证）、`proxy.js`（域名路由的反向代理）

**前端 (React + Vite + TypeScript)**
- 入口文件：`manager/client/src/main.tsx`
- 页面在 `manager/client/src/pages/`：Dashboard、CreateProject
- 组件在 `manager/client/src/components/`：IDE（Monaco 编辑器）、Resources（KV/D1/R2 管理器）、ChangePasswordModal
- 服务在 `manager/client/src/services/`：后端通信的 API SDK
- 国际化：`manager/client/src/locales/`（中/英 JSON 文件）

**进程管理（核心）**
- `manager/utils/spawner.js` 是管理 Wrangler 进程的核心运行时引擎
- 每个 Worker/Pages 项目作为子进程运行，通过 `spawn('npx', ['wrangler', ...])`
- 处理 Workers（`wrangler dev`）和 Pages（`wrangler pages dev [dir]`）两种类型
- 自动检测项目结构：单文件、ZIP 上传、带 source/dist 目录的构建项目
- 进程生命周期：启动、停止、重启、状态跟踪（通过 Map<projectId, ChildProcess>）

**资源模拟**
- KV：基于文件的键值存储，位于 `.platform-data/kv-data/`
- D1：SQLite 数据库，位于 `.platform-data/d1-databases/`，使用 `better-sqlite3`
- R2：对象存储模拟，有专用的管理 worker 在 `manager/system-workers/r2-admin/`
- 资源绑定：项目通过 ID 引用资源，`wrangler.toml` 由 `manager/utils/generator.js` 动态生成

**数据持久化**
- 所有数据存储在 `.platform-data/` 目录（作为 Docker 卷挂载）
- `projects.json`：项目元数据（名称、类型、端口、绑定）
- `resources.json`：KV/D1/R2 资源定义
- `auth.json`：密码哈希和 JWT 密钥
- `uploads/`：项目源代码
- `temp_builds/`：Pages 项目的构建产物

### 请求流程

1. **项目部署**：用户上传代码 → `routes/upload.js` 保存到 `.platform-data/uploads/` → `project-service.js` 创建元数据 → `runtime-service.js` 通过 `spawner.js` 启动 Wrangler 进程

2. **资源绑定**：用户将 KV/D1 绑定到项目 → `resource-service.js` 更新元数据 → `generator.js` 创建包含绑定的 `wrangler.toml` → 进程重启以应用配置

3. **域名路由**：请求到 `http://<项目名>-<类型>.localhost:8001` → `proxy.js` 中间件提取子域名 → 代理到内部端口（10000+）→ Wrangler 进程响应

4. **认证流程**：登录请求 → `auth-service.js` 验证密码 + 验证码 → 返回 JWT token → 客户端在 Authorization 头中包含 token → `auth.js` 中间件验证受保护路由

### 关键设计模式

**进程隔离**：每个项目在独立的 Wrangler 进程中运行，有专用端口。管理服务作为编排器，而非运行时。

**配置生成**：`wrangler.toml` 根据项目元数据和资源绑定动态生成。不要手动编辑 - 更改会被覆盖。

**端口管理**：
- 自动分配：系统从 10000 开始为内部 Wrangler 进程分配端口
- 自定义端口：用户可指定 1024-65535 端口，但必须在 `docker-compose.yml` 中手动添加端口映射
- 端口冲突检测：`utils/port-killer.js` 处理清理

**自动恢复**：启动时，`runtime-service.js` 读取 `projects.json` 并重启上次关闭前运行的所有项目。

### 开发工作流

1. **添加新 API 端点**：在 `manager/routes/` 创建路由，在 `server.js` 注册，按需添加认证中间件，在 `services/` 实现逻辑

2. **添加前端功能**：在 `manager/client/src/components/` 创建组件，在 `App.tsx` 添加路由，在 `services/` 实现 API 调用，在 `locales/` 添加国际化键

3. **修改项目运行时**：编辑 `utils/spawner.js` 处理进程管理，`utils/generator.js` 处理 wrangler.toml 生成，同时测试 Workers 和 Pages 项目类型

4. **数据库模式变更**：D1 数据库是 SQLite 文件 - 直接使用 `better-sqlite3` API。无迁移系统 - 模式由应用管理。

### Docker 架构

`Dockerfile` 中的多阶段构建：
1. **阶段 1 (frontend-builder)**：用 pnpm 构建 React 应用，输出到 `dist/`
2. **阶段 2 (production)**：Node.js 运行时带 Wrangler CLI，复制构建好的前端，启动 Express 服务器

容器暴露端口：
- 8001：管理界面和反向代理
- 9100：R2 管理服务

卷挂载 `.platform-data/` 确保容器重启后数据持久化。

### 重要约束

- **Wrangler 版本**：通过 Dockerfile 中的 pnpm 全局管理。更改版本需要重新构建。
- **Node.js 版本**：需要 Node 20+（Dockerfile 中指定）
- **Better-sqlite3**：原生模块 - 更改 Node 版本或架构时必须重新构建
- **端口冲突**：自定义端口需要手动 Docker 端口映射
- **网络隔离**：项目在 Docker 网络内运行 - 外部访问仅通过反向代理或映射端口

### 故障排查

**Wrangler 安装失败**：Dockerfile 使用阿里云镜像（`registry.npmmirror.com`）适应国内网络。如果构建卡住，检查 DNS/代理。

**端口已被占用**：`port-killer.js` 尝试自动清理。如果持续存在，在主机上检查 `lsof -i :<端口>`。

**项目无法启动**：检查 Docker 容器日志（`docker logs ccfwp-container`）。常见问题：缺少 `wrangler.toml`、无效绑定、端口冲突。

**前端构建失败**：确保安装了 Node 20+ 和 pnpm。用 `pnpm lint` 检查 TypeScript 错误。

**数据库损坏**：D1 数据库是 `.platform-data/d1-databases/` 中的 SQLite 文件。可用 `sqlite3` 命令行工具检查/修复。