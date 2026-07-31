# CCFWP 部署指南

项目根目录包含了用于构建和部署 **CCFWP 管理平台** 生产环境镜像的配置。

## 📦 目录结构

- `Dockerfile`: 多阶段构建脚本，负责编译前端 React 应用、Node.js 后端和带 Cloudflare DNS 插件的 Caddy。
- `docker-compose.yml`: 生产环境编排配置，定义了端口映射和数据持久化。

生产编排的管理服务、升级器、项目运行时和 Caddy 共用同一个显式版本镜像。镜像仓库通过
`CCFWP_IMAGE_REPOSITORY` 配置，版本通过 `CCFWP_IMAGE_TAG` 配置；镜像与应用发行包都只接受
`v1.2.3` 形式的严格 SemVer，禁止使用 `latest`。

## 🚀 部署步骤

### 1. 确保环境
确保本机或服务器已安装 Docker 和 Docker Compose。

### 2. 本地构建并启动

**⚠️ 重要**: 请务必在 **项目根目录** 下执行命令，而不是进入 `deploy` 目录。

```bash
# 在项目根目录执行
docker compose up -d --build
```

### 3. 在本地发布到 Docker Hub

Docker 镜像只允许在维护者本机打包并推送，GitHub Actions 不参与镜像构建。镜像必须使用
不可变 SemVer Tag；同一镜像内包含平台固定运行环境和带 Cloudflare DNS 插件的 Caddy，并同时支持
amd64 与 arm64：

```bash
docker login
export DOCKERHUB_USERNAME=<你的 Docker Hub 用户名>
export CCFWP_IMAGE_REPOSITORY=docker.io/$DOCKERHUB_USERNAME/ccfwp-platform
./scripts/docker-release.sh publish v1.2.3
```

先在 Docker Hub 创建 `ccfwp-platform` 仓库；登录时使用 Docker Hub Access Token，不要把密码写进命令
或镜像。发布脚本拒绝脏工作区，并通过本机 Buildx 直接推送多架构清单，保证镜像 Tag 对应确定的
Git SHA 和内置应用版本。

### 4. 服务器部署与回滚

服务器准备好 `.env`、Caddy 数据卷和 `.platform-data` 后执行：

```bash
export CCFWP_IMAGE_REPOSITORY=docker.io/<你的 Docker Hub 用户名>/ccfwp-platform
./scripts/docker-release.sh deploy v1.2.3
./scripts/docker-release.sh rollback
```

脚本会拉取同一镜像启动 `ccfwp` 与 `caddy`，并在 `.ccfwp-image-state` 保存当前和上一版本
Tag。该状态文件不包含密钥，已加入 Git 忽略规则。该操作用于 Node、Caddy、Wrangler 或
系统依赖变化；日常应用代码升级不需要替换 Docker 镜像。

## 发布职责边界

- Docker Hub 镜像：只运行本机 `scripts/docker-release.sh publish vX.Y.Z` 构建并上传。
- GitHub Actions：`ci.yml` 仅由 `app-release.yml` 调用；CI 全部通过后才生成并签名在线升级所需的应用程序包。
- Docker 镜像包含固定运行环境、系统依赖、Caddy 和初始应用快照；日常代码更新由 GitHub Release 完成。

## 在线应用升级

首次 Compose 部署后，后续 Manager 前后端代码通过公开 GitHub Releases 更新。`.env` 必须配置：

```dotenv
CCFWP_GITHUB_REPOSITORY=sailong/cpcf-workers-pages
CCFWP_RELEASE_SIGNER_ISSUER=https://token.actions.githubusercontent.com
CCFWP_UPDATER_TOKEN=<openssl rand -hex 32 的独立结果>
CCFWP_RELEASE_RETENTION=3
CCFWP_MAX_RELEASE_BYTES=2147483648
```

发布应用版本的唯一入口是推送严格 SemVer Tag。普通分支推送、Pull Request 和手动操作都不会
启动工作流；应用程序包打包和签名由 GitHub Actions 完成，不会构建或推送 Docker 镜像：

```bash
# 推送不可变版本 Tag
git tag v1.2.4 && git push origin v1.2.4
```

工作流先执行后端、前端、运行时隔离和 E2E 测试；任何 CI 作业失败都会阻止发布。通过后再为
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

### 6. 访问
生产环境通过 Caddy 访问 `CONSOLE_HOST`（仅公开 80/443）。`http://localhost:8001` 只适用于
`docker-compose.dev.yml` 的本机开发编排，不应作为公网入口。

## 💾 数据持久化
所有项目代码、数据库和配置都会自动保存到根目录下的 `.platform-data` 文件夹中。
迁移服务器时，只需备份并迁移该文件夹即可保留所有数据。

## 构建依赖信任默认值

生产 Compose 默认启用更保守的构建策略：

- `BUILD_NETWORK_MODE=prefer-offline`：安装阶段优先使用本地缓存，脚本阶段默认无外网
- `BUILD_REGISTRY_ALLOWLIST`：只允许访问白名单 registry
- `BUILD_DEFAULT_REGISTRY`：非白名单 registry 会被替换为安全默认源

可在 `.env` 中覆盖，参见 `.env.production.example`。
