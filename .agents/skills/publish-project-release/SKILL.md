---
name: publish-project-release
description: Prepare, publish, monitor, and verify a release of this repository. Use when the user asks to prepare or publish a strict SemVer version, create release notes, build and push the local multi-architecture Docker image, push a version Tag, run the signed GitHub application release workflow, verify release assets, or diagnose a release failure.
---

# 发布项目版本

## 目标

按严格顺序发布本项目的两类产物：

- Docker Hub 镜像：只在维护者本机构建并推送，包含固定运行环境、Caddy 和升级器。
- GitHub Release 应用包：由版本 Tag 触发 GitHub Actions，在 CI 全部通过后生成、签名并发布。

始终读取仓库当前文件，不依赖旧对话中的命令或版本号。以 `AGENTS.md`、`docs/deployment.md`、
`docs/publishing.md`、`.github/workflows/app-release.yml` 和 `scripts/docker-release.sh` 为事实来源。

## 发布边界

根据用户措辞选择模式：

- “准备版本”：只检查、修改版本说明并运行本地验证；不提交、不推送、不创建 Tag、不发布镜像。
- “发布版本”：完成验证后才允许提交和外部发布。执行 `git push`、Docker Hub 推送、生产部署或
  Tag 推送前，先展示版本、提交 SHA、产物范围和命令，获得明确确认；用户已明确要求立即发布
  具体版本时可视为确认，但仍要报告即将发生的外部变更。

不要把“创建发布 Skill”或“演练发布”解释为真实发布授权。

## 强制规则

1. 只接受 `^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`，禁止 `latest`、预发布版本和无 `v` 前缀版本。
2. 不移动、覆盖或复用已推送的 Tag、Docker Tag 或 GitHub Release。失败后使用新的补丁版本。
3. 只推送指定 Tag，禁止 `git push --tags`。
4. 不使用 `workflow_dispatch` 绕过 Tag 和 CI；普通分支推送不应触发发布工作流。
5. 不在 GitHub Actions 构建 Docker 镜像。使用 `scripts/docker-release.sh publish VERSION`。
6. 不打印或提交 Docker Hub 密码、GitHub Token、Cloudflare Token、`.env` 或生产数据。
7. 不用 `--no-verify` 绕过 Git Hook，不删除失败证据，不自动回退公共 Tag。
8. 不混入无关工作区变更。发现未知修改时先识别所有者和发布影响。

## 发布流程

### 1. 审计当前状态

先执行只读检查：

- 确认当前分支、工作区状态、远程仓库和 HEAD SHA。
- 按数字顺序读取稳定 Tag，确认最新版本和建议的下一版本。
- 检查目标 Git Tag、GitHub Release 和 Docker Tag 是否已存在。
- 比较上一个稳定 Tag 到 HEAD 的变更，确定发布范围。

默认建议递增补丁版本；涉及不兼容行为或用户指定时再使用 minor/major。不要自行修改已经确认的版本。

### 2. 判断是否需要 Docker 运行环境版本

以下变化要求发布并部署新 Docker 镜像：

- `Dockerfile`、`updater/`、Caddy、Compose、Node/Wrangler/Cosign 或系统依赖变化。
- 应用包压缩格式、升级协议、入口进程或容器运行方式变化。

普通 `manager/` 前后端业务代码只需要 GitHub 应用发行包。

如果升级器或应用包格式变化，必须先让生产服务器运行新升级器镜像并通过健康检查，再推送 Git Tag。
旧升级器无法读取新格式时，不得先发布在线升级包。

### 3. 创建版本说明

创建 `docs/releases/VERSION.md`，第一行必须是 `# VERSION`，至少包含：

```markdown
# vX.Y.Z

## 版本简介

一句话说明本版本的用户价值。

## 主要变化

- 用户可感知变化
- 运维、兼容性或安全变化

## 升级说明

说明是否需要先更新 Docker 镜像、配置或数据库。
```

只写已经实现并验证的内容。版本说明必须与发布代码提交到同一个 Tag；缺少文件会阻止发布。

### 4. 本地验证

在任何外部发布前依次运行：

```bash
./scripts/test-all.sh
./scripts/test-runtime-broker.sh
./scripts/test-e2e.sh
git diff --check
```

确认 `.github/workflows/app-release.yml` 仍满足：

- 仅 SemVer Tag 推送触发。
- `release` 作业依赖可复用 CI。
- amd64 和 arm64 资产均为 `tar.gz`。
- 使用 Cosign GitHub OIDC 签名 `manifest.json`。
- 使用 `docs/releases/${VERSION}.md` 作为 Release 正文。

任一检查失败即停止。修复、重新运行完整受影响检查，再继续。

### 5. 提交发布内容

只暂存本次发布文件，使用 Conventional Commit。确认提交包含版本说明，然后推送当前分支。
普通分支推送不会发布版本。

提交后重新记录 HEAD SHA。Tag、Docker 镜像和 GitHub Release 必须指向该 SHA 对应源码。

### 6. 发布 Docker 镜像（仅在需要时）

从仓库根目录使用明确仓库和版本：

```bash
export CCFWP_IMAGE_REPOSITORY=docker.io/<用户名>/ccfwp-platform
./scripts/docker-release.sh publish vX.Y.Z
docker buildx imagetools inspect "$CCFWP_IMAGE_REPOSITORY:vX.Y.Z"
```

确认多架构清单同时包含 `linux/amd64` 和 `linux/arm64`。需要运行环境迁移时，在服务器部署此精确
Tag，并确认 `ccfwp`、`ccfwp-updater`、`caddy` 健康后才能继续。不得改用 `latest`。

### 7. 推送版本 Tag

确认目标 Tag 和 Release 仍不存在，再创建注释 Tag 并只推送该 Tag：

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Tag 一旦推送即视为不可变。不要在 CI 失败后移动它。

### 8. 监控 CI 和签名发布

使用 `gh run list/view/watch` 找到此 Tag 对应的 `Publish Signed Application Release` 运行，并等待终态。
不要把排队或单个作业成功当作发布完成。

发布成功后使用 `gh release view VERSION --json ...` 验证：

- Release 已发布，非草稿、非预发布，正文来自 `docs/releases/VERSION.md`。
- 存在 `ccfwp-app-VERSION-linux-amd64.tar.gz`。
- 存在 `ccfwp-app-VERSION-linux-arm64.tar.gz`。
- 存在 `manifest.json`、`manifest.sig`、`checksums.txt`。
- 不存在 `.tar.zst` 应用资产。

必要时下载到 `mktemp -d` 创建的临时目录，核对 `checksums.txt`、清单版本、Git SHA、架构、大小和
SHA-256。使用清单中的精确证书身份验证 Cosign，不放宽为正则或通配符。

### 9. 交付结果

报告以下内容：

- 版本、Tag SHA、发布范围和是否发布 Docker 镜像。
- 本地测试、GitHub CI、两个架构产物和签名验证结果。
- Docker 镜像地址、GitHub Release URL 和生产部署状态。
- 在线升级前的必要操作及已知风险。

不要把“已准备”“已推送 Tag”“CI 运行中”描述为“发布成功”。

## 失败处理

- 本地测试失败：不提交、不推送，修复后重跑。
- Docker 发布失败：不推送 Git Tag；保留错误并修复。
- Tag CI 失败：不移动公共 Tag，不覆盖 Release；修复后准备新的补丁版本和版本说明。
- Release 资产不完整或签名失败：禁止在线升级，保留失败状态并使用新版本重新发布。
- 生产镜像更新失败：使用 `scripts/docker-release.sh rollback` 恢复上一镜像；不要用新应用包升级。
