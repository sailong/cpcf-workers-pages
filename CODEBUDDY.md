# CODEBUDDY.md

本文件描述当前仓库的实际架构。贡献前先阅读根目录的 `AGENTS.md`。

## 项目概览

这是一个本地 Cloudflare Workers/Pages 运维控制台：Express 管理 API 和 React/Vite UI 位于 `manager/`，资源运行时在 `manager/services/resource-runtime.js`，项目运行时默认由 Docker Runtime Broker 隔离。D1/KV/R2 只在本机模拟，不连接公网 Cloudflare 资源。

控制面数据使用 `.platform-data/control-plane.sqlite3`，旧版 JSON 仅用于一次性迁移并保留只读备份。项目源码和不可变 Release 位于 `.platform-data/projects/`；上传与构建临时目录由配置统一管理。

## 开发命令

```bash
docker compose -f docker-compose.dev.yml up --build
cd manager && npm ci && npm test
cd manager/client && npm ci && npm run dev
```

生产/隔离运行必须使用 Docker Provider；`RUNTIME_PROVIDER=process` 仅用于明确的本机调试。忘记本地管理员密码时，使用 `npm run reset-admin-password`，不要直接编辑认证文件。

## 关键约束

- 每个项目拥有独立容器、网络、资源绑定、端口和运行限制；不要共享项目目录或运行时状态。
- 项目发布使用不可变 Release；上传后立即激活，并通过 Release API 回滚。
- D1/KV/R2 删除先进入 30 天回收站；恢复不恢复项目绑定，同名资源在回收期间保留占用。
- 所有管理路由使用服务端会话 Cookie；禁止提交凭据、`.env`、`.platform-data/` 或生成目录。
- 动态配置由服务生成，不要手改 `wrangler.toml`、`manager/client/dist/`、`test-results/` 或 `playwright-report/`。

## 测试与提交

`./scripts/test-all.sh` 运行后端、前端覆盖率、Lint、类型检查、构建和审计；`./scripts/test-runtime-broker.sh` 验证 Docker 隔离；`./scripts/test-e2e.sh` 在临时 Compose 环境运行 Playwright。提交前运行 `git diff --check`。提交信息遵循 Conventional Commits，例如 `fix(runtime): serialize lifecycle operations`。
