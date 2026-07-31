# CCFWP 部署指南

项目根目录包含了用于构建和部署 **CCFWP 管理平台** 生产环境镜像的配置。

## 📦 目录结构

- `Dockerfile`: 多阶段构建脚本，负责编译前端 React 应用并打包 Node.js 后端。
- `docker-compose.yml`: 生产环境编排配置，定义了端口映射和数据持久化。

生产编排默认使用 `ccfwp-platform:0.1.0`，管理服务和项目运行时共用同一个显式版本标签。升级时通过 `.env` 中的 `CCFWP_IMAGE_TAG` 选择新标签，不要使用 `latest`。

## 🚀 部署步骤

### 1. 确保环境
确保本机或服务器已安装 Docker 和 Docker Compose。

### 2. 启动服务

**⚠️ 重要**: 请务必在 **项目根目录** 下执行命令，而不是进入 `deploy` 目录。

```bash
# 在项目根目录执行
docker compose up -d --build
```

### 3. 访问
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
