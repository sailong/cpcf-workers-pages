# CCFWP 部署指南

项目根目录包含了用于构建和部署 **CCFWP 管理平台** 生产环境镜像的配置。

## 📦 目录结构

- `Dockerfile`: 多阶段构建脚本，负责编译前端 React 应用、Node.js 后端和带 Cloudflare DNS 插件的 Caddy。
- `docker-compose.yml`: 标准生产编排，由镜像内的 Caddy 终止 80/443。
- `docker-compose.1panel.yml`: 1Panel 反向代理编排，只绑定宿主机 `127.0.0.1:38003`。
- `.env.1panel.example`: 1Panel 专用环境变量模板，不包含 Caddy/ACME 配置。

生产编排的管理服务、升级器、项目运行时和 Caddy 共用同一个显式版本镜像。镜像仓库通过
`CCFWP_IMAGE_REPOSITORY` 配置，版本通过 `CCFWP_IMAGE_TAG` 配置；镜像与应用发行包都只接受
`v1.2.4` 形式的严格 SemVer，禁止使用 `latest`。

## 🚀 部署步骤

### 1. 确保环境
确保本机或服务器已安装 Docker 和 Docker Compose。

### 2. 本机开发（不用于公网）

本机开发使用独立的开发编排；生产编排包含 Caddy、公开域名和必需的生产密钥，不要用它代替开发环境。
请务必在项目根目录执行：

```bash
docker compose -f docker-compose.dev.yml up --build
```

生产服务器使用 Docker Hub 的固定版本镜像，必须执行 `--no-build`，避免在服务器重新构建镜像。

### 3. 在本地发布到 Docker Hub

Docker 镜像只允许在维护者本机打包并推送，GitHub Actions 不参与镜像构建。镜像必须使用
不可变 SemVer Tag；同一镜像内包含平台固定运行环境和带 Cloudflare DNS 插件的 Caddy，并同时支持
amd64 与 arm64：

```bash
docker login
export DOCKERHUB_USERNAME=<你的 Docker Hub 用户名>
export CCFWP_IMAGE_REPOSITORY=docker.io/$DOCKERHUB_USERNAME/ccfwp-platform
./scripts/docker-release.sh publish v1.2.4
```

先在 Docker Hub 创建 `ccfwp-platform` 仓库；登录时使用 Docker Hub Access Token，不要把密码写进命令
或镜像。发布脚本拒绝脏工作区，并通过本机 Buildx 直接推送多架构清单，保证镜像 Tag 对应确定的
Git SHA 和内置应用版本。

### 4. 标准 Docker 服务器部署与回滚

生产编排不再要求服务器准备源码、`Caddyfile` 或相对路径 `.platform-data`。`.env.production.example`
只用于生成配置模板，实际文件名必须是 `.env`；`CCFWP_DATA_DIR` 应指向稳定的绝对宿主机路径：

```bash
cp .env.production.example .env
# 编辑 .env，至少配置域名、密码、Cloudflare DNS Token、镜像仓库、版本、数据目录和升级器 Token
./scripts/public-preflight.sh

export CCFWP_IMAGE_REPOSITORY=docker.io/<你的 Docker Hub 用户名>/ccfwp-platform
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d --no-build --wait --wait-timeout 180
```

也可以使用部署脚本完成拉取、启动和版本状态记录：

```bash
./scripts/docker-release.sh deploy v1.2.4
./scripts/docker-release.sh rollback
```

脚本会启动 `ccfwp`、`ccfwp-updater` 与 `caddy`，并在 `.ccfwp-image-state` 保存当前和上一版本
Tag。该状态文件不包含密钥，不能删除；镜像级回滚只适用于 Node、Caddy、Wrangler、Cosign 或
系统依赖变化。日常应用代码升级不需要替换 Docker 镜像。

## 发布职责边界

- Docker Hub 镜像：只运行本机 `scripts/docker-release.sh publish vX.Y.Z` 构建并上传。
- GitHub Actions：`ci.yml` 仅可在 Actions 页面手动运行；`app-release.yml` 在严格 SemVer Tag 上独立生成并签名在线升级所需的应用程序包。
- Docker 镜像包含固定运行环境、系统依赖、Caddy 和初始应用快照；日常代码更新由 GitHub Release 完成。

## 在线应用升级

首次 Compose 部署后，后续 Manager 前后端代码通过公开 GitHub Releases 更新。`.env` 必须配置：

```dotenv
CCFWP_GITHUB_REPOSITORY=sailong/cpcf-workers-pages
CCFWP_RELEASE_SIGNER_ISSUER=https://token.actions.githubusercontent.com
CCFWP_UPDATER_TOKEN=<openssl rand -hex 32 的独立结果>
CCFWP_RELEASE_RETENTION=3
CCFWP_MAX_RELEASE_BYTES=2147483648
CCFWP_MANAGER_HEALTH_TIMEOUT_MS=180000
```

发布应用版本的唯一入口是推送严格 SemVer Tag。普通分支推送和 Pull Request 不会启动 CI 或发布工作流；
CI 也可以在 Actions 页面手动运行，但手动运行 CI 不会发布应用程序包。应用程序包打包和签名由 GitHub Actions
完成，不会构建或推送 Docker 镜像：

```bash
# 先提交 docs/releases/v1.2.4.md，再推送不可变版本 Tag
git tag -a v1.2.4 -m "v1.2.4"
git push origin v1.2.4
```

`docs/releases/vX.Y.Z.md` 必须和代码一起提交到该 Tag。工作流会在上传签名资产前校验文件存在，
并将其作为 GitHub Release 的正式介绍；缺少文件会阻止发布。

发布工作流不会自动执行 CI；请在发布前按需手动运行 `CI` 并确认通过。发布工作流随后为
amd64、arm64 分别生成包含生产 `node_modules` 和前端 `dist` 的 `tar.gz`，并使用 Cosign GitHub
OIDC 对 `manifest.json` 无密钥签名。已存在的 GitHub Release 不允许覆盖。
升级器会根据仓库、固定工作流路径和目标 Tag 自动生成唯一证书身份，不接受可放宽的身份正则配置。

从旧的 `tar.zst` 发行格式迁移时，必须先发布并部署一次包含新版升级器的 Docker 镜像，再发布首个
`tar.gz` 应用版本；旧镜像内的升级器无法读取新格式。完成这次运行环境升级后，后续应用版本继续
通过 GitHub Release 在线升级，无需重复替换 Docker 镜像。

管理员在“设置 > 应用版本”填写明确的 `vX.Y.Z` 后执行升级。升级器依次完成 Cosign 身份校验、
SHA-256 和架构校验、数据库迁移 dry-run、完整 release 快照、原子切换、重启及健康检查。dry-run
失败不会切换 `current`；切换后健康检查失败会恢复原版本和迁移前数据库快照。可随时一键回滚到
上一完整应用快照，回滚前也会先验证数据库兼容性。保留最近 3 个发行版本，并额外保护当前和上一版本。

`CCFWP_MANAGER_HEALTH_TIMEOUT_MS` 默认是 180000（3 分钟），用于等待管理容器恢复健康；如果项目较多、
运行时恢复较慢，可适当增加。超时错误会包含最近一次 Docker 健康检查输出，便于判断是启动失败、域名配置
还是反向代理探针问题。

本次健康等待修复位于固定镜像中的 `/app/updater/server.js`。服务器如果仍在运行旧镜像，单独发布
GitHub 应用包不会更新升级器；请先在维护者本机发布并部署一次新 Docker 镜像。完成后，后续应用版本
继续只通过 GitHub Release 在线更新，无需重复替换镜像。

### 5. 1Panel 反向代理部署

1Panel 不应直接使用标准 `docker-compose.yml`。请粘贴 [`docker-compose.1panel.yml`](../docker-compose.1panel.yml)，
由 1Panel 负责证书和 HTTPS，再把控制台域名与 `*.PROJECTS_BASE_DOMAIN` 都反代到
`127.0.0.1:38003`。完整的请求头、WebSocket、验证、升级和回滚步骤见[1Panel 反向代理部署](1panel.md)。

## 访问

标准 Docker 部署通过 Caddy 访问 `CONSOLE_HOST`（公开 80/443）。1Panel 部署通过 1Panel 的 HTTPS
站点访问，`127.0.0.1:38003` 只允许本机反向代理访问，不应直接暴露到公网。

## 💾 数据持久化
所有项目代码、数据库和配置都会保存到 `CCFWP_DATA_DIR` 指定的宿主机目录（默认
`/opt/1panel/apps/ccfwp/data`）。迁移服务器时，先停止编排，再备份并迁移该目录即可保留所有数据。
该目录必须是宿主机绝对路径，不能改成 Docker 命名卷，因为项目运行容器需要直接挂载其中的发行文件。

## 构建依赖信任默认值

镜像构建阶段默认启用更保守的构建策略：

- `BUILD_NETWORK_MODE=prefer-offline`：安装阶段优先使用本地缓存，脚本阶段默认无外网
- `BUILD_REGISTRY_ALLOWLIST`：只允许访问白名单 registry
- `BUILD_DEFAULT_REGISTRY`：非白名单 registry 会被替换为安全默认源

可在 `.env` 中覆盖，参见 `.env.production.example`。
