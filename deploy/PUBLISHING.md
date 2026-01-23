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
    # 在项目根目录下执行
    docker build -t your-username/ccfwp:latest -f deploy/Dockerfile .
    ```

    > 注意：必须在项目根目录执行，因为 Dockerfile 需要访问 manager 目录。

2.  **推送镜像**
    ```bash
    docker push your-username/ccfwp:latest
    ```

## 3. 构建多架构镜像 (推荐)

为了让镜像同时支持 **AMD64** (普通 Linux 服务器/Windows) 和 **ARM64** (Apple Silicon M1/M2/M3, 树莓派)，强烈建议使用 `buildx` 进行构建。

### 步骤

1.  **创建构建实例 (首次需要)**
    ```bash
    docker buildx create --use
    ```

2.  **构建并直接推送**
    这条命令会自动构建两种架构的镜像，并合并推送到 Docker Hub。
    
    ```bash
    docker buildx build \
      --platform linux/amd64,linux/arm64 \
      -t your-username/ccfwp:latest \
      -f deploy/Dockerfile \
      --push .
    ```

## 4. 用户如何使用你的镜像？

当镜像发布成功后，其他用户无需下载源码，只需使用以下 `docker-compose.yml` 即可启动：

```yaml
services:
  ccfwp:
    image: your-username/ccfwp:latest  # <--- 修改这里为你发布的镜像名
    container_name: ccfwp
    ports:
      - "8001:8001"
      - "8002-8020:8002-8020"
    volumes:
      - ./data:/app/.platform-data
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

用户只需运行：
```bash
docker-compose up -d
```
