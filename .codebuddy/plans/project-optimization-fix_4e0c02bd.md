---
name: project-optimization-fix
overview: 对 CCFWP 项目进行全面的安全加固和代码质量优化，修复 Critical/Major 级别的安全和功能问题
todos:
  - id: fix-command-injection
    content: 修复命令注入风险：在 routes/projects.js 和 routes/build.js 添加命令白名单验证
    status: completed
  - id: fix-sql-injection
    content: 修复 SQL 注入风险：在 utils/d1-helper.js 添加表名白名单验证
    status: completed
  - id: fix-upload-security
    content: 添加文件上传限制：在 middleware/upload.js 配置文件大小和类型限制
    status: completed
  - id: enhance-auth-security
    content: 增强认证安全：使用 crypto 生成 JWT 密钥，增加密码复杂度验证
    status: completed
  - id: fix-path-traversal
    content: 修复目录遍历防护：在 routes/files.js 使用 path.resolve 和 URL 解码检查
    status: completed
  - id: add-cross-platform
    content: 添加跨平台支持：在 utils/port-killer.js 支持 Windows 命令
    status: completed
  - id: fix-resource-leak
    content: 修复资源泄漏：SSE 添加超时和心跳，临时文件添加清理机制
    status: completed
  - id: optimize-code-quality
    content: 优化代码质量：统一前端 API 客户端，统一错误处理模式
    status: completed
    dependencies:
      - fix-command-injection
      - fix-sql-injection
---

## 项目深度分析与优化需求

对 CCFWP (Cloudflare 本地平台) 项目进行全面代码审查，发现以下需要修复和优化的问题：

### Critical 级别问题（需立即修复）

1. **命令注入风险** - `buildCommand` 未验证直接传给 `spawn` 执行
2. **SQL 注入风险** - 表名直接拼接到 SQL 语句
3. **文件上传无限制** - 无文件大小和类型验证

### Major 级别问题（应尽快修复）

1. **硬编码凭证** - 默认密码 `admin`，JWT 密钥生成使用 `Math.random()`
2. **目录遍历防护不完整** - 仅检查 `..`，未处理 URL 编码绕过
3. **跨平台兼容性** - `lsof` 和 `fuser` 命令仅 Linux/macOS 可用
4. **资源泄漏风险** - SSE 连接无超时机制、临时文件可能残留

### Minor 级别问题（计划优化）

1. 重复代码：SSE 处理逻辑多处重复
2. 错误处理不一致
3. 性能问题：D1 查询使用 `execSync` 阻塞事件循环
4. 前端存在两个 API 客户端文件功能重复

## 技术方案

### 安全修复方案

#### 1. 命令注入防护

- 实现命令白名单机制，只允许安全的构建命令（npm、pnpm、yarn）
- 使用参数化执行，禁止 shell 元字符
- 添加命令超时限制

#### 2. SQL 注入防护

- 表名白名单验证：使用正则 `^[a-zA-Z_][a-zA-Z0-9_]*
- 拒绝 SQL 关键字作为表名
- 使用参数化查询替代字符串拼接

#### 3. 文件上传安全

- 添加 `multer` 的 `limits` 配置：`fileSize: 50 * 1024 * 1024`
- 文件类型白名单：`.js, .ts, .zip, .json, .wasm`
- MIME 类型验证

#### 4. 认证安全增强

- 使用 `crypto.randomBytes(64)` 生成 JWT 密钥
- 密码复杂度验证：至少 8 位，包含大小写和数字
- 首次登录强制修改默认密码

#### 5. 目录遍历防护

- 使用 `path.resolve()` 和 `path.normalize()` 处理路径
- URL 解码后再检查危险字符
- 验证最终路径在允许目录内

### 跨平台兼容方案

```javascript
// 检测平台并使用对应命令
const isWindows = process.platform === 'win32';
const killPort = isWindows 
  ? `netstat -ano | findstr :${port}` + `taskkill /PID ${pid} /F`
  : `lsof -ti:${port} | xargs kill -9`;
```

### 资源管理方案

- SSE 连接：添加 30 分钟超时 + 30 秒心跳
- 临时文件：使用 `try-finally` 确保清理
- 构建产物：添加定时清理任务

### 性能优化方案

- KV 数据：添加 LRU 缓存（最大 1000 条）
- D1 查询：使用 `better-sqlite3` 异步 API
- 项目列表：WebSocket 实时更新替代轮询

## 目录结构

```
manager/
├── middleware/
│   └── upload.js           # [MODIFY] 添加文件大小和类型限制
├── routes/
│   ├── auth.js             # [MODIFY] 增强密码策略
│   ├── build.js            # [MODIFY] 添加命令白名单验证
│   ├── files.js            # [MODIFY] 增强目录遍历防护
│   └── projects.js         # [MODIFY] SSE 超时、命令验证
├── services/
│   └── auth-service.js     # [MODIFY] 使用 crypto 生成密钥
├── utils/
│   ├── d1-helper.js        # [MODIFY] SQL 注入防护
│   ├── port-killer.js      # [MODIFY] 跨平台支持
│   └── spawner.js          # [MODIFY] 命令执行安全
└── client/src/
    ├── api.ts              # [MODIFY] 统一 API 客户端
    └── services/api.ts     # [DELETE] 合并到根目录 api.ts
```

## 使用的扩展

### SubAgent

- **code-explorer**: 已用于深度探索项目代码库，发现所有安全问题和优化点