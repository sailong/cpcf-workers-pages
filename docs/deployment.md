# CCFWP 部署指南

项目根目录包含了用于构建和部署 **CCFWP 管理平台** 生产环境镜像的配置。

## 📦 目录结构

- `Dockerfile`: 多阶段构建脚本，负责编译前端 React 应用、Node.js 后端和带 Cloudflare DNS 插件的 Caddy。
- `docker-compose.yml`: 生产环境编排配置，定义了端口映射和数据持久化。

生产编排的管理服务、项目运行时和 Caddy 共用同一个显式版本镜像。镜像仓库通过
`CCFWP_IMAGE_REPOSITORY` 配置，版本通过 `CCFWP_IMAGE_TAG` 配置；不要使用 `latest`。

## 🚀 部署步骤

### 1. 确保环境
确保本机或服务器已安装 Docker 和 Docker Compose。

### 2. 本地构建并启动

**⚠️ 重要**: 请务必在 **项目根目录** 下执行命令，而不是进入 `deploy` 目录。

```bash
# 在项目根目录执行
docker compose up -d --build
```

### 3. 发布到 Docker Hub

镜像必须使用不可变 Tag，建议使用 Git 提交短 SHA。Dockerfile 会同时构建 amd64 和 arm64
所需的 Caddy 与平台镜像：

```bash
export DOCKERHUB_USERNAME=<你的 Docker Hub 用户名>
export CCFWP_IMAGE_REPOSITORY=docker.io/$DOCKERHUB_USERNAME/ccfwp-platform
./scripts/docker-release.sh publish "$(git rev-parse --short=12 HEAD)"
```

先在 Docker Hub 创建 `ccfwp-platform` 仓库，再执行 `docker login`；使用 Docker Hub Access Token，
不要把密码写进命令或镜像。发布脚本拒绝脏工作区，保证 Git SHA Tag 对应确定的源代码。

### 4. 服务器部署与回滚

服务器准备好 `.env`、Caddy 数据卷和 `.platform-data` 后执行：

```bash
export CCFWP_IMAGE_REPOSITORY=docker.io/<你的 Docker Hub 用户名>/ccfwp-platform
./scripts/docker-release.sh deploy <git-sha-tag>
./scripts/docker-release.sh rollback
```

脚本会拉取同一镜像启动 `ccfwp` 与 `caddy`，并在 `.ccfwp-image-state` 保存当前和上一版本
Tag。该状态文件不包含密钥，已加入 Git 忽略规则。

### 5. GitHub Actions 发布

在仓库 Secrets 中配置 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN`。推送 `v1.2.3` 格式的 Git
Tag，或手动运行 `Publish Docker Image` 并填写 `image_tag`，即可发布 amd64/arm64 镜像。

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
