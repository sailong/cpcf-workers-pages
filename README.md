# CCFWP 管理平台 (Cloudflare Local Platform)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Stack](https://img.shields.io/badge/Stack-Docker%20%7C%20React%20%7C%20Node.js-blue)](https://nodejs.org/)

**CCFWP 管理平台** 是一个基于 Docker 的本地 Cloudflare 开发环境，旨在为开发者还原真实的工作流。允许你在本地动态创建、编辑、部署和管理多个 Workers 和 Pages 项目，并内置了完整的 KV 和 D1 数据库模拟支持。

![Screenshot Placeholder](https://via.placeholder.com/1200x600?text=CCFWP+Dashboard)

---

## ✨ 核心特性 (Features)

### 🖥️ 全功能管理控制台
- **现代化仪表盘**: 基于 React 和 Tailwind CSS 构建的美观、响应式界面。
- **中文本地化**: 全站深度汉化，符合国内开发者习惯。
- **实时状态检测**: 精确监控服务运行状态 (Running/Stopped)，自动轮询更新，杜绝状态不同步。
- **服务自动恢复**: 系统重启后，自动恢复上次正在运行的所有项目，无需手动启动。

### ⚡️ Serverless 项目管理
- **Workers & Pages**: 统一管理两种类型的 Cloudflare 项目。
- **在线代码编辑器**: 集成 Monaco Editor，支持 TypeScript/JavaScript 语法高亮与智能提示。
- **动态部署**: 一键保存代码并自动热重载，秒级生效。
- **文件上传**: 支持上传单文件 (Worker) 或 ZIP 包 (Pages 静态站点)。
- **智能端口分配**:
- **智能端口分配**:
    - **自动模式 (推荐)**: 留空端口，系统自动分配内部端口 (10000+)。
        - **访问地址**: 通过统一反向代理访问。
            - **Worker**: `http://<项目名>-worker.localhost:8001`
            - **Pages**: `http://<项目名>-pages.localhost:8001`
    - **自定义模式**: 支持绑定任意端口 (1024-65535)。
        - **注意**: 自定义端口**默认无法从外部访问**。必须在 `docker-compose.yml` 的 `ports` 部分手动添加映射（如 `- "8080:8080"`）并重启容器。
    - **冲突检测**: 自动检测端口占用并提示。
- **旧项目兼容**: 自动检测并修复旧项目配置（如缺失的资源绑定），确保平滑迁移。

### 📦 资源与存储模拟
- **KV 键值存储 (Key-Value)**:
    - 创建/删除 KV 命名空间。
    - 可视化键值管理：添加、编辑、查看、删除 Key-Value 数据。
- **D1SQL 数据库**:
    - 创建/删除 D1 数据库实例。
    - **SQL 控制台**: 直接执行 SQL 语句 (Execute/Query)。
    - **表结构查看器**: 可视化查看表字段、类型、主键等 Schema 信息。
    - **数据浏览**: 像使用图形化客户端一样浏览表数据。
- **资源绑定 (Bindings)**: 
    - 简单的 UI 操作将 KV/D1 绑定到 Worker/Pages 项目。
    - 自动生成 `wrangler.toml` 配置。
    - **R2 服务增强**:
        - 强制绑定 `0.0.0.0`，完美解决 Docker 网络通信问题。
        - 支持 IPv6 端口检测与清理，彻底解决 "Address already in use" 崩溃问题。

### 🔐 认证与安全 (Authentication & Security)
- **安全登录系统**: 集成 `svg-captcha` 图形验证码，有效防止暴力破解。
- **JWT 身份验证**: 采用 JWT (JSON Web Token) 进行全站鉴权，自动处理会话过期与续期。
- **密码管理**:
    - 支持修改管理员密码，凭证持久化存储于 `.platform-data/auth.json`。
    - **JWT Secret 持久化**: 确保服务重启后 Token 不失效。
- **环境变量管理**: 支持 Plain Text、JSON、Secrets 三种类型的环境变量。
- **敏感数据脱敏**: 界面默认隐藏敏感 Secret 值，支持一键切换显示/隐藏。

---

## 🚀 快速开始 (Getting Started)

### 前置要求
- **Docker Desktop** (必须)
- Docker Compose

### 启动平台

只需要一条命令即可启动整个环境：

```bash
docker-compose up -d --build
```

启动完成后，访问管理控制台：
**http://localhost:8001**

*   **默认密码**: `admin`
*   登录成功后，即可开始管理您的 Worker 项目与资源。
*   **重置密码**: 如果忘记密码，可删除或修改 `.platform-data/auth.json` 文件。

### ⚙️ 环境配置 (Environment Configuration)
您可以在 `docker-compose.yml` 环境变量中修改默认配置：

*   `MANAGER_SERVICE_PORT`: 管理后台服务内部监听端口 (默认 `3000`)
    *   **注意**: 修改此变量后，必须同步修改 `docker-compose.yml` 中的 `ports` 映射（例如 `"8001:3000"` 中的 `3000`）。
*   `AUTH_PASSWORD`: 管理后台登录密码 (默认 `admin`)
*   `R2_ADMIN_PORT`: R2 管理服务端口 (默认 `9100`)

    *   **部署场景**: 如果部署到公网或使用反向代理（如 1Panel），请将其设置为你的域名（例如 `ccfwp.example.com`）。此时项目访问地址将变为 `http://<项目名>-<类型>.ccfwp.example.com:端口`。

---

### ❓ 常见问题 (FAQ)

#### 1. Wrangler 安装失败或卡住
如果在 `docker-compose build` 阶段，安装 `wrangler` 时长时间无响应，通常是由于 Docker 容器内访问 npm 官方源网络受限。

**解决方案**:
本项目 Dockerfile 已针对国内网络环境优化：
1.  **切换包管理器**: 使用 **Yarn** 替代 npm，连接更稳定。
2.  **配置镜像源**: 默认使用 `https://registry.npmmirror.com`。

如果问题依旧，请检查 Docker 守护进程的 DNS 设置或宿主机网络代理。

---

## 🛠️ 技术栈 (Tech Stack)

*   **Runtime**: Cloudflare Wrangler (Local Mode)
*   **Backend**: Node.js (Express), `jsonwebtoken` (Auth), `svg-captcha` (Security), `better-sqlite3`, `child_process` (Spawner)
*   **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Monaco Editor
*   **Infrastructure**: Docker, Docker Compose

## 🗂 目录结构

```
.
├── Dockerfile                # 多阶段生产构建
├── docker-compose.yml        # 生产环境编排
├── docker-compose.dev.yml    # 开发环境编排 (挂载源码)
├── README.md
│
├── manager/                  # 核心服务
│   ├── server.js             # 后端入口 (轻量级)
│   ├── package.json
│   ├── routes/               # API 路由定义
│   ├── middleware/           # 中间件 (Auth, Proxy)
│   ├── services/             # 业务逻辑服务
│   ├── client/               # 前端 React 应用 (Vite)
│   │   └── src/
│   │       ├── components/   # 通用组件 (IDE, Resources)
│   │   │   ├── pages/        # 页面组件
│   │   │   ├── services/     # 前端 APISDK
│   │   │   ├── types/        # TypeScript 类型
│   │   │   ├── App.tsx       # 路由配置
│   │   │   └── main.tsx      # 入口文件
│   │   └── dist/             # 构建产物 (后端托管)
│   ├── utils/                # 后端工具模块
│   │   ├── spawner.js        # 进程管理器 (核心)
│   │   ├── generator.js      # wrangler.toml 配置生成
│   │   ├── d1-helper.js      # D1 数据库操作
│   │   ├── kv-storage.js     # KV 存储引擎
│   │   ├── r2-admin-manager.js # R2 服务管理
│   │   └── crypto-helper.js  # 加密/脱敏工具
│   ├── system-workers/       # 系统级 Worker (R2 Admin)
│   └── tests/                # 测试脚本
│
├── docs/                     # 文档中心
│   ├── deployment.md         # Docker 部署指南
│   ├── manual-run.md         # 手动运行指南
│   ├── 1panel.md             # 1Panel 部署指南
│   └── publishing.md         # 镜像发布指南
│
├── examples/                 # 示例项目
│   └── cfmail/               # Cloudflare 邮件路由方案
│
└── .platform-data/           # (自动生成) 持久化数据
    ├── auth.json             # 认证凭证
    ├── projects.json         # 项目元数据
    ├── resources.json        # 资源元数据
    ├── uploads/              # 项目代码文件
    ├── d1-databases/         # D1 SQLite 文件
    ├── kv-data/              # KV 持久化数据
    └── r2-data/              # R2 对象存储数据
```

## � 致谢 (Acknowledgements)

特别感谢以下开源项目和技术，让本项目成为可能：

- **[Cloudflare Wrangler](https://github.com/cloudflare/workers-sdk)**: 本地运行环境的核心支持
- **[React](https://react.dev/) & [Vite](https://vitejs.dev/)**: 极速的前端开发体验
- **[Tailwind CSS](https://tailwindcss.com/)**: 现代化的 UI 样式构建
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)**: 提供卓越的代码编辑体验
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)**: 高性能的 Node.js SQLite 接口

## �📝 License

This project is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
