# Docker Hub 发布指南

本文档将指导你如何将 CCFWP 平台打包成镜像并推送到 Docker Hub，以便其他人可以直接下载使用。

## 1. 前置准备

1.  **注册账号**: 确保你拥有 [Docker Hub](https://hub.docker.com/) 账号。
2.  **本地登录**:
    在终端中运行以下命令并输入你的用户名和密码：
    ```bash
    docker login
    ```

## 2. 构建并推送 (标准方法)

如果你只需要支持与你当前开发机相同架构的设备 (例如你用的是 Intel Mac，对方也是 Intel 服务器)，可以使用标准构建。

### 步骤

1.  **构建镜像**
    将 `your-username` 替换为你的 Docker Hub 用户名。
    ```bash
    # 在项目根目录下执行 (兼容当前架构)
    docker build -t your-username/ccfwp:0.1.0 .
    ```

    > 注意：必须在项目根目录执行，因为 Dockerfile 需要访问 manager 目录。

2.  **推送镜像**
    ```bash
    docker push your-username/ccfwp:0.1.0
    ```

## 3. 构建多架构镜像 (推荐)

为了让镜像同时支持 **AMD64** (普通 Linux 服务器/Windows) 和 **ARM64** (Apple Silicon M1/M2/M3, 树莓派)，强烈建议使用 `buildx` 进行构建。

### 步骤

1.  **创建构建实例 (首次需要)**
    ```bash
    # 创建并启动一个新的构建器实例，支持多架构
    docker buildx create --use --name mybuilder --driver docker-container --bootstrap
    ```

2.  **构建并直接推送**
    这条命令会自动构建 `linux/amd64` (x86_64) 和 `linux/arm64` (Apple Silicon) 两种架构的镜像，并合并推送到 Docker Hub。
    
    > **注意**: 
    > *   由于我们优化了 Dockerfile，`better-sqlite3` 等原生依赖会在容器内根据目标架构自动编译，因此兼容性得到了保证。
    > *   跨架构构建 (例如在 Mac 上构建 amd64 镜像) 需要 QEMU 模拟，速度会比本地构建慢，这是正常的。
    
    ```bash
    docker buildx build \
      --platform linux/amd64,linux/arm64 \
      -t your-username/ccfwp:0.1.0 \
      --push .
    ```

## 4. 用户如何使用你的镜像？

公网部署必须同时运行管理服务与仓库提供的 Caddy 入口。使用根目录的
`docker-compose.yml` 和 `.env.production.example`，填写管理员密码、控制台域名、
项目根域名、Cloudflare DNS Token 与内部入口凭证。生产环境只开放 80/443；
管理端口 8001 和资源网关 9200 均保持在容器网络内部。

完成配置后先执行：
```bash
./scripts/public-preflight.sh
docker compose --env-file .env -f docker-compose.yml up -d
```
