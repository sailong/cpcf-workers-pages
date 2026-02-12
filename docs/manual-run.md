
# 手动运行说明 (Running Without Docker)

如果您不想使用 Docker，可以直接在主机上通过 Node.js 运行本项目。请按照以下步骤操作。

## 前置要求 (Prerequisites)

*   **Node.js**: v18.0.0 或更高版本
*   **npm**: 生成环境通常自带
*   **Linux/macOS**: 建议环境 (Windows 可能需要 WSL)

## 1. 准备项目文件

确保您已经完整下载了项目代码。项目的核心目录结构如下：

```
/workers-pages-d1sql-workerskv
  ├── manager/           # 核心代码
  │   ├── client/        # 前端界面 (React + Vite)
  │   ├── server.js      # 后端入口
  │   └── ...
  ├── docs/              # 文档与部署配置
  ├── Dockerfile         # 生产环境构建文件
  └── .platform-data/    # [重要] 数据存储目录 (运行时自动生成)
```

## 2. 安装依赖 (Install Dependencies)

您需要分别安装后端和前端的依赖。

### 2.1 安装后端依赖
在 `manager` 目录下运行：
```bash
cd manager
npm install
```

### 2.2 安装前端依赖并构建

进入前端目录并构建：
```bash
cd manager/client
npm install
npm run build
```
> **重要说明**：后端服务 (`server.js`) 会自动托管 `manager/client/dist` 目录中的静态文件。**必须**先执行 `npm run build` 生成此目录，否则访问首页会出现 404 错误。

## 3. 环境变量配置 (Environment Variables)

您可以直接在命令行设置环境变量，或创建一个 `.env` 文件（如果您想持久化配置）。
以下是主要的环境变量：

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `MANAGER_SERVICE_PORT` | `3000` | 后端服务监听端口 |
| `R2_ADMIN_PORT` | `9099` | R2 管理界面端口 (可选) |


## 4. 启动服务 (Start Server)

回到 `manager` 目录，启动后端服务。

### 方式 A：直接启动 (开发/调试)

您可以自由选择以下两种配置方式：

**1. 使用 .env 文件 (推荐)**
在 `manager` 目录下创建一个名为 `.env` 的文件，填入以下内容：
```bash
MANAGER_SERVICE_PORT=8001
R2_ADMIN_PORT=9100
```
然后直接运行：
```bash
node server.js
```

> **注意**：此处创建的 `.env` 文件**不会影响** Docker 运行环境。
> 项目的 `.dockerignore` 已配置排除 `.env`，因此 Docker 容器会始终使用 `docker-compose.yml` 中的配置，两者互不干扰。

**2. 使用 命令行变量**

**Linux / macOS / Git Bash:**
```bash
export MANAGER_SERVICE_PORT=8001
export R2_ADMIN_PORT=9100
node server.js
```

**Windows (CMD):**
```cmd
set MANAGER_SERVICE_PORT=8001
set R2_ADMIN_PORT=9100
node server.js
```

**Windows (PowerShell):**
```powershell
$env:MANAGER_SERVICE_PORT="8001"
$env:R2_ADMIN_PORT="9100"
node server.js
```

### 方式 B：后台运行 (生产环境推荐)
建议使用 `pm2` 来管理进程。

```bash
# 安装 pm2
npm install -g pm2

# 启动服务
pm2 start server.js --name "cf-platform" --env MANAGER_SERVICE_PORT=8001
```

## 5. 访问应用

启动成功后，打开浏览器访问：

*   **管理面板**: `http://localhost:3000` (或您配置的端口)


## 6. 数据备份

所有数据（数据库、上传的文件、配置文件）都存储在项目根目录下的 `.platform-data/` 文件夹中。
**请务必定期备份该目录。**
