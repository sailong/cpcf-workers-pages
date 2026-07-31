# Docker Hub 本地发布指南

Docker 镜像只在维护者本机构建并推送到 Docker Hub。GitHub Actions 不构建镜像；GitHub 上的
`app-release.yml` 只生成和签名线上升级使用的应用程序包。

## 前置准备

1. 在 Docker Hub 创建 `ccfwp-platform` 仓库，并创建 Access Token。
2. 本机安装 Docker Desktop 或 Docker Engine、Compose 与 Buildx。
3. 确保待发布代码已提交；发布脚本会拒绝脏工作区。
4. 登录 Docker Hub，不要把 Token 写入仓库、脚本参数或镜像：

```bash
docker login
```

## 构建并上传多架构镜像

在仓库根目录执行：

```bash
export DOCKERHUB_USERNAME=<你的 Docker Hub 用户名>
export CCFWP_IMAGE_REPOSITORY=docker.io/$DOCKERHUB_USERNAME/ccfwp-platform
./scripts/docker-release.sh publish v1.2.3
```

脚本只接受 `vX.Y.Z` 严格 SemVer，不接受 `latest`、预发布版本或无 `v` 前缀版本。它会在本机调用
Buildx 构建 `linux/amd64` 与 `linux/arm64`，将 Caddy、固定运行环境和初始应用快照放入同一个镜像，
然后直接推送多架构清单到 Docker Hub。跨架构构建使用 QEMU 时较慢属于正常现象。

可用以下命令确认两个平台均已发布：

```bash
docker buildx imagetools inspect \
  docker.io/<你的 Docker Hub 用户名>/ccfwp-platform:v1.2.3
```

## 服务器首次部署

服务器使用仓库中的 `docker-compose.yml` 和 `.env.production.example`。至少配置镜像仓库、镜像
版本、管理员密码、域名、Cloudflare DNS Token、升级器独立 Token 和 GitHub 仓库：

```dotenv
CCFWP_IMAGE_REPOSITORY=docker.io/<你的 Docker Hub 用户名>/ccfwp-platform
CCFWP_IMAGE_TAG=v1.2.3
CCFWP_GITHUB_REPOSITORY=sailong/cpcf-workers-pages
CCFWP_UPDATER_TOKEN=<独立的 32 字节以上随机密钥>
```

```bash
./scripts/public-preflight.sh
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d --no-build --wait
```

此后普通前后端代码通过已签名的 GitHub Release 应用包在线升级；只有 Node、Wrangler、Caddy、
Cosign 或系统依赖发生变化时，才需要再次发布并部署 Docker 镜像。镜像级回滚使用：

```bash
./scripts/docker-release.sh rollback
```
