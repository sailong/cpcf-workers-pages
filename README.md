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
- **智能端口分配**: 自动管理本地端口资源 (8000+)，确保服务互不冲突。

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

### 🔐 配置与安全
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
👉 **http://localhost:3000**

---

## �️ 技术栈 (Tech Stack)

*   **Runtime**: Cloudflare Wrangler (Local Mode)
*   **Backend**: Node.js (Express), `better-sqlite3` (Internal), `child_process` (Spawner)
*   **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Monaco Editor
*   **Infrastructure**: Docker, Docker Compose

## � 目录结构

```
.
├── docker-compose.yml       # 容器编排配置
├── manager/
│   ├── server.js            # 后端 API 服务
│   ├── client/              # 前端 React 应用
│   ├── utils/
│   │   ├── spawner.js       # 进程管理器 (核心)
│   │   ├── generator.js     # 配置文件生成器
│   │   └── d1-helper.js     # D1 数据库操作封装 (Wrapper)
│   └── ...
└── .platform-data/          # (自动生成) 持久化数据目录
    ├── uploads/             # 项目代码文件
    ├── d1-databases/        # D1 SQLite 文件
    ├── projects.json        # 项目元数据
    └── resources.json       # 资源元数据
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
