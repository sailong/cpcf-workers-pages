# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 项目概览

CCFWP (Cloudflare 本地平台) 是一个基于 Docker 的本地开发环境，模拟 Cloudflare Workers/Pages 运行时。提供 Web UI 管理多个 Serverless 项目，内置 KV/D1/R2 资源模拟，支持在线代码编辑、构建部署和进程编排。

## 常用命令

### Docker 环境

```bash
# 生产构建启动
docker-compose up -d --build

# 开发模式（源码挂载，热重载）
docker-compose -f docker-compose.dev.yml up -d --build

# 访问管理界面: http://localhost:8001 (默认密码: admin)
```

### 前端开发

```bash
cd manager/client
pnpm install      # 安装依赖
pnpm dev          # 开发服务器（热重载）
pnpm build        # 生产构建到 client/dist
pnpm lint         # TypeScript/ESLint 检查
pnpm preview      # 预览生产构建
```

### 后端开发

```bash
cd manager
pnpm install      # 安装依赖
node server.js    # 启动服务器（需先构建前端）

# 环境变量:
# MANAGER_SERVICE_PORT - 管理端口 (默认 3000)
# R2_ADMIN_PORT - R2 管理端口 (默认 9100)
# AUTH_PASSWORD - 登录密码 (默认 admin)
```

### 测试

```bash
cd manager
node tests/test-runner.js  # 运行后端测试

# API 手动测试: 所有路由在 /api/* 下，需 JWT token 认证
```

## 架构设计

### 分层架构

```
前端层 (React + Vite + TypeScript)
  ↓ HTTP API (JWT Auth)
后端层 (Express + Node.js)
  ├─ 路由层: routes/ (auth, projects, resources-*, upload, build, files)
  ├─ 服务层: services/ (project, runtime, resource, auth)
  ├─ 工具层: utils/ (spawner, generator, kv-storage, d1-helper, safe-exec, sse-helper)
  └─ 中间件: middleware/ (auth, proxy, upload)
  ↓ spawn('npx wrangler')
运行时层 (Wrangler 子进程)
  ├─ Worker 项目 (独立进程)
  ├─ Pages 项目 (独立进程)
  └─ R2 Admin Worker (系统服务)
  ↓ 文件系统 + SQLite
持久化层 (.platform-data/)
  ├─ JSON 配置: projects.json, resources.json, auth.json
  ├─ KV 数据: kv-data/*.json
  ├─ D1 数据库: d1-databases/*.sqlite
  ├─ 上传代码: uploads/
  └─ 构建产物: temp_builds/
```

### 核心业务流程

**1. 项目生命周期**

```
创建项目
  ├─ 验证名称 (字母/数字/连字符，同类型唯一)
  ├─ 分配端口 (自定义或自动 10000-20000)
  ├─ 处理代码来源:
  │   ├─ buildId: 从 temp_builds 复制源码和产物
  │   ├─ code+filename: 直接写入 uploads/
  │   └─ mainFile: 引用已有文件
  └─ 保存到 projects.json

启动项目
  ├─ 强制释放端口 (killPort 清理僵尸进程)
  ├─ 生成 wrangler.toml (generator.js)
  ├─ 启动 Wrangler 子进程 (spawner.js)
  │   ├─ Worker: wrangler dev <file> --config <toml>
  │   └─ Pages: wrangler pages dev <dir> [--kv/--d1/--r2]
  ├─ 播种 KV 数据 (临时 Seeder Worker 注入)
  └─ 更新状态为 running

停止项目
  ├─ SIGTERM 优雅关闭
  ├─ fuser -k <port>/tcp 强制释放端口
  └─ 清理进程映射 (Map<projectId, ChildProcess>)

删除项目
  ├─ 停止运行中的进程
  ├─ 物理删除 uploads/ 目录/文件
  └─ 从 projects.json 移除元数据
```

**2. 资源绑定机制**

用户绑定 KV/D1/R2 → `resource-service.js` 更新 resources.json → `generator.js` 动态生成 wrangler.toml → 重启项目应用配置

**3. 反向代理路由**

```
请求: http://myapp-worker.localhost:8001
  ↓ 提取子域名 (proxy.js)
匹配: 项目名称=myapp, 类型=worker
  ↓ 查询 projects.json
代理: http://127.0.0.1:<project.port>
```

**4. 认证流程**

```
获取验证码 → JWT 签名验证码文本 (5分钟有效)
  ↓
提交登录表单 → 验证验证码 + 用户名密码
  ↓
生成 JWT Token (7天有效) → 检查默认密码标志
  ↓
后续请求: Authorization: Bearer <token> → auth.js 中间件验证
```

### 关键设计模式

**进程隔离**: 每个项目独立 Wrangler 子进程，通过 `Map<projectId, ChildProcess>` 跟踪。管理服务是编排器，非运行时。

**配置生成**: `wrangler.toml` 根据项目元数据动态生成（KV/D1/R2 绑定、环境变量）。**不要手动编辑，更改会被覆盖**。

**端口管理**:
- 自动分配: 从 10000 扫描可用端口 (范围 10000-20000)
- 自定义端口: 用户指定 1024-65535，需在 docker-compose.yml 手动映射
- 冲突检测: 双重检查 (项目占用 + 系统进程) + `port-killer.js` 清理

**KV 播种机制**: 启动 Pages 项目前，动态生成临时 Seeder Worker，将 `.platform-data/kv-data/<namespaceId>.json` 数据注入 Wrangler 本地状态，完成后自动清理。

**D1 安全执行**: 通过 Wrangler CLI 执行 SQL (`wrangler d1 execute`)，使用 `--persist-to` 共享状态目录确保多 Worker 访问同一数据库。包含表名验证、SQL 注入防护。

**SSE 实时推送**: 构建/部署进度通过 Server-Sent Events 推送，30 分钟超时 + 30 秒心跳，支持客户端断开自动清理。

**安全命令执行**: 白名单机制 (npm/yarn/pnpm/npx/vite/wrangler 等) + 危险字符检测 (`;&|`$`, `../`, `${}`) + 无 Shell 模式 spawn。

**自动恢复**: 服务启动时，`runtime-service.js` 读取 `projects.json` 中 status='running' 的项目并自动重启。

### 环境变量管理

支持三种类型（写入 wrangler.toml）:
- `plain`: 明文字符串 → `[vars]` 区段
- `json`: JSON 对象 → `[vars]` 区段 (直接序列化)
- `secret`: 加密文本 → `[[unsafe.bindings]]` 区段

### Docker 架构

**多阶段构建**:
1. **frontend-builder**: pnpm 构建 React 应用 → `dist/`
2. **production**: Node.js + Wrangler CLI，复制前端产物，启动 Express

**端口暴露**:
- 8001: 管理界面 + 反向代理
- 9100: R2 管理服务

**卷挂载**: `.platform-data/` 确保容器重启后数据持久化

### 重要约束

- **Wrangler 版本**: Dockerfile 中 pnpm 全局管理，更改需重新构建
- **Node.js 版本**: 需要 Node 20+ (Dockerfile 指定)
- **better-sqlite3**: 原生模块，更改 Node 版本/架构需重新编译
- **wrangler.toml**: 动态生成，手动编辑会被覆盖
- **网络隔离**: 项目在 Docker 网络内运行，外部访问仅通过反向代理或映射端口
- **共享状态**: 所有 Worker/Pages 使用 `--persist-to` 指向同一目录，确保 D1 数据一致性

### 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| Wrangler 安装失败 | 网络受限 | Dockerfile 已配置 npmmirror 镜像，检查 DNS/代理 |
| 端口被占用 | 僵尸进程 | `port-killer.js` 自动清理，或 `lsof -i :<port>` 手动检查 |
| 项目无法启动 | 缺少 wrangler.toml/无效绑定 | 检查资源绑定，查看 `docker logs ccfwp-container` |
| D1 数据不一致 | 未使用共享状态 | 确保 `--persist-to` 指向 `.platform-data/wrangler-shared-state` |
| 前端构建失败 | Node 版本/pnpm 问题 | 确保 Node 20+，运行 `pnpm lint` 检查 TypeScript |
| 数据库损坏 | SQLite 文件异常 | 用 `sqlite3 .platform-data/d1-databases/*.sqlite` 检查/修复 |
| R2 服务崩溃 | 端口冲突 (IPv4/IPv6) | `r2-admin-manager.js` 自动清理 /proc/net/tcp* 占用进程 |

### 开发工作流

**添加新 API 端点**:
1. 在 `manager/routes/` 创建路由文件
2. 在 `server.js` 注册路由
3. 按需添加认证中间件
4. 在 `services/` 实现业务逻辑

**添加前端功能**:
1. 在 `manager/client/src/components/` 创建组件
2. 在 `App.tsx` 添加路由
3. 在 `services/` 实现 API 调用
4. 在 `locales/` 添加国际化键 (中/英 JSON)

**修改项目运行时**:
- 编辑 `utils/spawner.js` 处理进程管理
- 编辑 `utils/generator.js` 处理 wrangler.toml 生成
- 同时测试 Workers 和 Pages 两种项目类型

**数据库模式变更**:
- D1 是 SQLite 文件，直接使用 `better-sqlite3` API 或 Wrangler CLI
- 无迁移系统，模式由应用代码管理
