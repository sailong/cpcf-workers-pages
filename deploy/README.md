# CCFWP 部署指南

本目录包含了用于构建和部署 **CCFWP 管理平台** 生产环境镜像的配置。

## 📦 目录结构

- `Dockerfile`: 多阶段构建脚本，负责编译前端 React 应用并打包 Node.js 后端。
- `docker-compose.yml`: 生产环境编排配置，定义了端口映射和数据持久化。

## 🚀 部署步骤

### 1. 确保环境
确保本机或服务器已安装 Docker 和 Docker Compose。

### 2. 启动服务

**⚠️ 重要**: 请务必在 **项目根目录** 下执行命令，而不是进入 `deploy` 目录。

```bash
# 在项目根目录执行
docker-compose -f deploy/docker-compose.yml up -d --build
```

### 3. 访问
启动完成后，访问浏览器：
http://localhost:8001

## 💾 数据持久化
所有项目代码、数据库和配置都会自动保存到根目录下的 `.platform-data` 文件夹中。
迁移服务器时，只需备份并迁移该文件夹即可保留所有数据。
