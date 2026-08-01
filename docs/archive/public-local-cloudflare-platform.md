# 公网本地 Cloudflare 平台实施计划

> 本文是历史实施计划。当前已经实现的行为和运维要求以[部署指南](../deployment.md)、
> [兼容性说明](../compatibility.md)以及仓库中的 CI/发布工作流为准。以下阶段检查清单仅用于保留设计历史，
> 不代表当前待办事项。

## 产品决策

- 管理器面向公网，并且始终只有一个管理员。
- 上传的源代码和 `package.json` 被视为可信，但项目之间以及项目与管理器密钥之间仍必须隔离。
- 平台只在本地模拟 Workers 和 Pages，不会将项目部署到 Cloudflare。
- 新版本上传并成功构建后立即生效，同时支持一键回滚到上一个不可变版本。
- 删除的 KV、D1 和 R2 资源进入保留 30 天的回收站。恢复资源时不恢复项目绑定，永久清理前继续保留资源名称。
- 兼容性目标为 Wrangler/workerd Worker API。KV 全球最终一致性等分布式边缘行为明确不在范围内。
- 项目路由基于管理员确认的控制台域名和项目基础域名。通配符 DNS 和 DNS-01 证书签发依赖已配置的 DNS 服务商。
- 每次构建和每个运行时都必须设置明确的 CPU、内存、PID、磁盘、上传、并发和持续时间限制。

## 阶段 0：文档调研（已完成）

### 允许使用的 API 和参考资料

- 固定仓库内的 Wrangler 版本，并使用文档规定的 Workers `dev` 和 Pages `pages dev` 参数：
  [Workers 命令](https://developers.cloudflare.com/workers/wrangler/commands/workers/)、
  [Pages 命令](https://developers.cloudflare.com/workers/wrangler/commands/pages/)和
  [本地数据](https://developers.cloudflare.com/workers/development-testing/local-data/)。
- 使用文档规定的 D1 预处理语句和迁移、KV TTL/元数据/游标行为、R2 Worker 方法以及 Pages Functions 上下文 API。
- 控制面元数据使用 `better-sqlite3` 事务和 WAL；标识符、密钥和原子激活使用 Node
  `crypto.randomUUID()`、SHA-256、AES-256-GCM 和 `fs/promises.rename()`。
- 通过权限收敛的运行时代理使用 Docker Engine 资源限制，包括 `Memory`、`NanoCpus`、`PidsLimit`、
  只读根文件系统、移除 capabilities 和 `no-new-privileges`：
  [Docker 资源限制](https://docs.docker.com/engine/containers/resource_constraints/)。
- 为固定的项目基础域名使用 Caddy DNS-01 通配符证书：
  [自动 HTTPS](https://caddyserver.com/docs/automatic-https)和
  [TLS 指令](https://caddyserver.com/docs/caddyfile/directives/tls)。

### 已验证并需要保留的现有模式

- 绑定 TOML 生成：`manager/utils/generator.js:22-61`。
- Pages 绑定参数组装：`manager/utils/spawner.js:107-187`。
- 上传限制结构：`manager/middleware/upload.js:102-110`。
- 现有 WebSocket 代理请求头：[1Panel 部署](../1panel.md)。

### 全局反模式约束

- 禁止未固定版本的 `npx wrangler`、`shell: true`、继承管理器环境、共享可写项目目录或共享不受限网络命名空间。
- 禁止直接覆盖 JSON 并将其作为权威元数据存储。
- 禁止在没有根目录包含校验的情况下使用请求数据生成路径。
- 禁止先删除再复制的部署、恢复旧绑定、不受限的 `Host` 推断或不受限的按需 TLS。
- 不得声称单机模拟器具备 Cloudflare 边缘缓存、地理一致性或完全等价的 CPU 时间行为。

## 阶段 1：公网管理器安全基线

### 实施内容

1. 在 Express 开始监听前增加可等待完成的启动引导流程。将包含答案的验证码 JWT 替换为服务端保存、一次性且会过期的挑战。
2. 将有效期七天的 localStorage Bearer 认证替换为不透明的服务端会话；会话只保存哈希，并通过
   `HttpOnly`、`Secure`、`SameSite=Strict` Cookie 传递。修改密码时递增会话版本并撤销已有会话。
3. 增加有界的登录/IP 限流、严格的 JSON 请求体限制、安全响应头、同源 CORS、可信代理配置以及控制台/项目 Host 白名单。
4. 将基于项目 ID 派生的 AES-CBC 密钥替换为持久化且权限为 0600 的主密钥和带版本的 AES-256-GCM 载荷；
   成功读取旧密文后立即迁移。
5. 增加共享的 `resolveWithin(base, value)` 辅助函数，并应用到构建 ID、输出目录、项目路径、部署清理和文件路由。
6. 解压前预检 ZIP 条目：规范化路径包含关系、条目数量、展开后字节限制、压缩比限制，并拒绝链接和特殊文件；升级存在漏洞的依赖。

### 文档参考

- 现有认证入口：`manager/routes/auth.js`、`manager/services/auth-service.js`、`manager/middleware/auth.js`、`manager/server.js`。
- 现有路径和构建入口：`manager/routes/build.js:28-99`、`manager/routes/projects.js:388-463`、`manager/routes/files.js:15-63`。
- 仅使用 Node 加密和文件系统 API，不自行发明 Token 或压缩包 API。

### 验证清单

- 隔离测试证明验证码 Token 不包含答案、挑战只能使用一次、登录受到限流、Cookie 包含全部必需属性，并且修改密码会撤销旧会话。
- 测试证明 `../`、绝对路径、编码后的目录穿越、相邻前缀路径和恶意 ZIP 条目均无法逃逸各自根目录。
- 旧密钥迁移能够往返验证，篡改密文后认证必须失败。
- 记录 `npm audit`、后端测试、前端 TypeScript、Lint 基线和 `git diff --check` 的结果。

### 反模式约束

- 不得在响应或日志中保存原始会话、验证码答案或主密钥。
- 不得将 CORS 当作认证，也不得信任任意 `X-Forwarded-Host`。
- 不得先解压后校验。

## 阶段 2：事务化控制面与回收站

### 实施内容

1. 增加 `manager/services/database.js`，使用 `PRAGMA user_version`、WAL、外键和事务实现单调递增迁移。
2. 在 SQLite 中建模项目、资源、项目绑定、部署、会话、审计事件和设置。现有 JSON 只导入一次，验证完成前保留只读备份。
3. 将资源 DELETE 实现为事务性软删除：设置 `deleted_at` 和 `purge_after`，移除全部绑定，停止暴露资源，并保留 `(kind, name)`。
4. 增加回收站列表、恢复和永久清理 API。恢复时只恢复资源记录和存储数据，绝不恢复绑定；增加带审计记录的 30 天清理任务。
5. 使用 `crypto.randomUUID()` 替换 `Date.now()` 标识符，并消除直接修改数组的 API。

### 文档参考

- 当前元数据实现：`manager/services/project-service.js`、`manager/services/resource-service.js` 和
  `manager/routes/resources-{kv,d1,r2}.js`。
- [SQLite 事务](https://www.sqlite.org/transactional.html)、[SQLite WAL](https://www.sqlite.org/wal.html)
  以及已安装的 `better-sqlite3` API。

### 验证清单

- 迁移测试覆盖全新安装、已有 JSON 导入、导入中断、JSON 损坏以及重复启动。
- 事务测试证明删除会原子移除绑定、回收站内名称继续被占用、恢复后绑定为空、永久清理后名称被释放。
- 测试只能使用临时目录和临时数据库，不得修改真实 `.platform-data`。

### 反模式约束

- 禁止通过多个独立 JSON 写入协调状态、解析失败后静默重置，或在事务提交前物理删除数据。
- 没有固定版本的往返测试夹具时，不得依赖 Wrangler 的私有状态布局。

## 阶段 3：不可变版本与即时回滚

### 实施内容

1. 将版本存储在 `.platform-data/projects/<project-id>/releases/<release-id>/`，暂存目录为 `staging/<release-id>/`。
2. 校验完整版本并计算哈希，然后原子切换数据库中的激活指针。上一个版本必须保持不可变且可以寻址。
3. 只有构建和健康检查成功后才立即激活上传版本。增加版本列表和一键回滚 API；回滚时激活上一个版本并重启运行时。
4. 将构建和部署日志保存为结构化部署事件，并通过保留策略限制数量。

### 文档参考

- 当时的破坏性流程：`manager/routes/projects.js:259-463`。
- Node `fs/promises.rename()` 和 `crypto.createHash('sha256')`。

### 验证清单

- 故障注入证明构建或部署中断不会修改当前激活版本。
- 连续部署两个版本后执行回滚，应重新提供第一个版本，并保留不可变校验和。
- 同一项目的并发部署请求必须串行执行。

### 反模式约束

- 替代版本通过验证前，绝不能清空当前激活的源代码或 `dist`。
- 绝不能原地修改或重新构建已有版本。

## 阶段 4：运行时代理、隔离与配额

### 实施内容

1. 引入运行时提供器接口以及唯一可访问 Docker Engine 的权限收敛代理服务。管理器不得传递任意 Docker 参数，
   项目容器不得获得 Docker Socket。
2. 构建固定 Wrangler 版本的运行时镜像。每次构建和每个项目都在独立容器中运行，并使用项目专属网络、
   最小环境、非 root UID、只读根文件系统、移除 capabilities、`no-new-privileges`、PID/CPU/内存限制和有界可写挂载。
3. 运行时只绑定内部接口。流量统一通过管理器/Caddy 入口，并用代理管理的容器生命周期替换 `fuser` 或端口强杀。
4. 在管理器中限制上传大小和构建时长，在代理中限制请求并发；只有宿主机存储驱动和文件系统确认支持时才启用硬磁盘配额。
   强制隔离能力不可用时，拒绝启动公网生产环境。
5. 只挂载当前激活版本和显式绑定的资源状态。构建容器绝不能获取资源状态或管理器密钥。

### 文档参考

- 当时的运行时实现：`manager/utils/spawner.js`、`manager/services/runtime-service.js`、Dockerfile 和 Compose 文件。
- Docker Engine 容器创建、资源限制以及默认 seccomp 文档。

### 验证清单

- 隔离夹具无法读取其他项目的版本或状态、管理器密钥、Docker Socket 或未绑定资源，也无法绑定任意宿主机端口。
- CPU、内存、PID、请求并发、上传大小、构建超时以及受支持的磁盘限制都必须有确定性的拒绝测试。
- 运行时清理只能删除代理拥有的容器和网络。

### 反模式约束

- 禁止向项目容器挂载 Docker Socket、继承完整管理器环境、使用宿主机网络、特权模式或拼接 Shell 命令。
- 不得把目录大小轮询描述为硬磁盘配额。

## 阶段 5：Wrangler 兼容性与资源语义

### 实施内容

1. 在平台运行时中固定一个 Wrangler/workerd 版本，并开放项目级 `compatibility_date` 和文档支持的标志。
2. 为 Workers `fetch`、Pages Functions、D1 语句/批处理/迁移、KV 字符串/TTL/元数据/游标分页，
   以及 R2 `head`/`get`/`put`/`delete`/`list`/分片上传建立一致性测试夹具。
3. 修复 D1 异步处理，并使用请求级文件替代共享配置和查询文件。统一 R2 ID 与名称，为每种资源定义唯一权威状态源。
4. 在 UI 和文档中标明仅限本地的差异，尤其是 KV 地理最终一致性差异。

### 文档参考

- 阶段 0 中收集的 Cloudflare D1、KV、R2、Pages Functions、Wrangler 和本地数据文档。
- 权威辅助实现：`manager/services/resource-runtime.js`、`manager/services/resource-gateway-server.js` 和
  `manager/utils/d1-helper.js`。

### 验证清单

- 一致性测试套件快照文档定义的方法签名和典型返回结构。
- 并发 D1 请求不能串用数据库、配置或查询文件。
- 回收站、恢复和永久清理的往返测试在固定版本运行时上保留每种资源的正确状态。

### 反模式约束

- 不允许上传项目选择平台使用的 Wrangler 版本。
- 不得仅根据管理器 CRUD API 声称完全兼容。

## 阶段 6：域名路由与自动 TLS

### 实施内容

1. 增加明确的 `CONSOLE_HOST` 和 `PROJECTS_BASE_DOMAIN` 设置。安全初始化时可根据当前可信 Host 提议值，
   但持久化前必须由管理员确认。
2. 只路由与已知运行项目匹配的精确 `<slug>-worker.<base>` 和 `<slug>-pages.<base>` Host。
   仅接受来自已配置可信代理的转发请求头。
3. 提供 `console.<domain>` 和 `*.apps.<domain>` 的 Caddy 配置生成、以密钥方式提供的 DNS-01 服务商凭据、
   证书续期状态和健康诊断。
4. DNS 服务商或通配符记录不可用时，显示可执行的配置状态，不得静默为每个 Host 分别签发证书。

### 文档参考

- 当时的代理实现：`manager/middleware/proxy.js` 和 [1Panel 部署](../1panel.md)。
- 阶段 0 中的 Caddy 自动 HTTPS/TLS 文档。

### 验证清单

- Host 路由测试拒绝任意后缀、伪造的转发请求头、未知或已停止项目以及 Slug 冲突。
- 使用 ACME/DNS 测试环境夹具验证通配符配置，不能消耗生产证书配额。

### 反模式约束

- 禁止持久化从任意 Host 推导的域名、不受限的按需 TLS，以及没有白名单的证书签发。

## 阶段 7：专业运维控制台

### 实施内容

1. 使用持续显示的响应式框架替代页面/卡片式导航：项目、部署、资源、回收站、设置。
2. 将项目列表设计为高密度表格，展示状态、类型、当前版本、路由健康状态、CPU/内存/磁盘、绑定、
   最近部署、错误摘要以及高效的行级操作。
3. 增加项目详情标签页：概览、部署、绑定、日志、设置。展示实时部署进度和清晰的“回滚到上一版本”操作。
4. 增加资源搜索、分页、容量摘要、绑定可见性、安全批量操作、回收站倒计时、恢复和永久清理确认。
5. 使用无障碍对话框、共享通知系统、可重试错误状态、骨架屏、空状态和操作中心，替换 `alert/confirm`
   以及各自独立的 Toast 实现。
6. 登录页展示管理器健康状态、验证码加载和重试、限流反馈、密码可见性、首次登录修改密码，以及键盘和屏幕阅读器语义。

### 文档参考

- 当时的路由和组件：`manager/client/src/App.tsx`、`pages/Dashboard.tsx`、`pages/Resources.tsx`、
  `pages/CreateProject.tsx`、`components/IDE/*`。
- 保留 React/Vite/Tailwind 和当前翻译系统；现有主题变量仅作为迁移输入，不要求保留玻璃拟态风格。

### 验证清单

- ESLint 和 TypeScript 全部通过且不得忽略错误。组件测试覆盖错误、加载、空状态和破坏性操作状态。
- Playwright 使用隔离夹具和语义化定位器，不硬编码默认密码或解码验证码；在没有固定休眠的情况下覆盖桌面端和移动端核心流程。
- 视觉检查确认所有支持的视口下都不存在重叠、控件裁切、对比度不可读或布局偏移。

### 反模式约束

- 禁止嵌套装饰卡片、仅使用 Emoji 的控件、隐藏服务端错误、浏览器原生破坏性对话框或尺寸过大且低密度的仪表盘卡片。

## 最终验证阶段

1. 重新阅读实现所依据的固定版本 Wrangler、Docker、SQLite 和 Caddy 文档，核对准确的签名和选项。
2. 搜索禁止模式：`shell: true`、未固定版本的 `npx wrangler`、共享且不受限的持久化、原始会话/验证码密钥、
   不安全的路径拼接、直接写入元数据 JSON、`alert(` 和 `confirm(`。
3. 运行隔离的后端、单元、集成和一致性测试套件，前端 Lint/类型检查/构建、Playwright 夹具测试、
   依赖审计、容器隔离测试以及 `git diff --check`。
4. 生成部署就绪报告，明确区分应用内部已完成工作和外部前提条件：宿主机 cgroup/配额支持、
   DNS 服务商凭据、通配符 DNS 和 ACME 可达性。
