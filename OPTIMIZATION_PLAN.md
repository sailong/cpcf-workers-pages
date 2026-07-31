# CCFWP 项目优化计划

> 历史计划。部分问题已被后续 Runtime Broker、不可变发布和隔离测试实现；请勿将本文件的未勾选项直接视为当前缺陷。

## 优先级 P0 - 严重安全问题

### 1. 密码明文存储
- **文件**: `services/auth-service.js`
- **问题**: 密码以明文存储在 auth.json
- **方案**: 使用 bcrypt 哈希存储

### 2. 命令注入风险
- **文件**: `utils/safe-exec.js`
- **问题**: npx 允许任意包名，黑名单可被绕过
- **方案**: 对 npx 实施包名白名单

### 3. 验证码可重放
- **文件**: `routes/auth.js`
- **问题**: 验证码 5 分钟内可无限次使用
- **方案**: 添加一次性标记

## 优先级 P1 - 功能缺陷

### 4. 测试端点不匹配
- **文件**: `tests/verify_bindings_update.js` (L120)
- **问题**: 使用 `PUT /config` 但实际是 `PATCH /:id`
- **方案**: 修复测试端点

### 5. 缺少 full-config 端点
- **文件**: `tests/verify_rebuild_persistence.js` (L83)
- **问题**: 调用不存在的 `/full-config` 端点
- **方案**: 添加端点或修改测试

### 6. SSE 代码重复
- **文件**: `routes/build.js`, `routes/projects.js`
- **问题**: 三段相同的 SSE 初始化代码
- **方案**: 提取为中间件

## 优先级 P2 - 性能优化

### 7. 项目启动串行
- **文件**: `services/runtime-service.js`
- **问题**: for...of 逐个启动
- **方案**: 改为 Promise.all 并行

### 8. KV 全量读写
- **文件**: `utils/kv-storage.js`
- **问题**: 每次操作读写整个 JSON
- **方案**: 添加内存缓存

### 9. D1 阻塞调用
- **文件**: `utils/d1-helper.js`
- **问题**: execSync 阻塞事件循环
- **方案**: 改为 exec 异步

## 优先级 P3 - 前端优化

### 10. ChangePasswordModal 样式不一致
- **文件**: `components/ChangePasswordModal.tsx`
- **问题**: 使用硬编码灰色主题
- **方案**: 使用 CSS 变量

### 11. ErrorBoundary 样式不一致
- **文件**: `components/ErrorBoundary.tsx`
- **问题**: 硬编码 bg-gray-950
- **方案**: 使用 neo-glass 样式

### 12. Dashboard 轮询优化
- **文件**: `pages/Dashboard.tsx`
- **问题**: 每 5 秒全量轮询
- **方案**: 添加退避策略

### 13. 缺少保存快捷键
- **文件**: `components/IDE/IDE.tsx`
- **问题**: 无 Ctrl+S 保存
- **方案**: 添加键盘快捷键

### 14. 日志面板无自动滚动
- **文件**: `components/IDE/IDE.tsx` (L234)
- **问题**: Deploy 日志不自动滚动
- **方案**: 添加 auto-scroll

### 15. 创建成功后表单未重置
- **文件**: `pages/CreateProject.tsx`
- **问题**: 创建后状态残留
- **方案**: 添加重置逻辑

## 优先级 P4 - 代码质量

### 16. 资源查找重复
- **文件**: `routes/resources-*.js`
- **问题**: 多次重复 find 调用
- **方案**: 提取验证中间件

### 17. 全局错误泄露详情
- **文件**: `server.js` (L61)
- **问题**: 返回 err.message
- **方案**: 生产环境隐藏详情

### 18. 并发写入无锁
- **文件**: `services/*.js`
- **问题**: 同步文件读写
- **方案**: 添加文件锁
