# 1Panel 一键部署

生产部署使用仓库根目录的 `docker-compose.yml`。这份编排已经适合直接粘贴到 1Panel：只拉取远程
Docker Hub 镜像，不需要上传源码、创建 `Caddyfile` 或在服务器构建镜像。Manager、在线升级器和 Caddy
使用同一个明确的 SemVer 镜像版本。

## 部署前准备

准备以下 DNS 记录，并确保服务器防火墙放行 TCP 80、443 和 UDP 443：

- `CONSOLE_HOST`，例如 `console.example.com`。
- `*.PROJECTS_BASE_DOMAIN`，例如 `*.apps.example.com`。

创建只允许目标 Zone DNS 编辑权限的 Cloudflare API Token。不要使用 Global API Key。

## 在 1Panel 中创建编排

1. 打开 **容器 > 编排 > 创建编排**，编排名称填写 `ccfwp`。
2. 将仓库根目录 `docker-compose.yml` 的完整内容粘贴到编排编辑器。
3. 在环境变量面板填写下表。变量名必须保持不变。
4. 保存并启动编排，等待 `ccfwp`、`ccfwp-updater` 和 `caddy` 都变为运行状态。

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `CCFWP_IMAGE_REPOSITORY` | `docker.io/simonchang/ccfwp-platform` | Docker Hub 镜像仓库 |
| `CCFWP_IMAGE_TAG` | `v1.2.4` | 已发布的严格 SemVer；禁止 `latest` |
| `CCFWP_DATA_DIR` | `/opt/1panel/apps/ccfwp/data` | 宿主机持久化目录，升级时保持不变 |
| `CONSOLE_HOST` | `console.example.com` | 管理控制台域名 |
| `PROJECTS_BASE_DOMAIN` | `apps.example.com` | 项目域名根 |
| `AUTH_PASSWORD` | 随机强密码 | 管理员初始密码 |
| `INGRESS_PROXY_TOKEN` | `openssl rand -hex 32` | Caddy 到 Manager 的独立凭证 |
| `CCFWP_UPDATER_TOKEN` | `openssl rand -hex 32` | Manager 到升级器的独立凭证 |
| `CCFWP_GITHUB_REPOSITORY` | `sailong/cpcf-workers-pages` | 公开 GitHub 仓库 |
| `ACME_EMAIL` | `admin@example.com` | 证书通知邮箱 |
| `CLOUDFLARE_API_TOKEN` | 受限 Token | DNS-01 证书签发 |

`CCFWP_IMAGE_TAG` 必须指向已经发布且内置 Caddy 配置的镜像。更新镜像时只修改这个变量并重新部署，
不要改成 `latest`。`CCFWP_DATA_DIR` 是宿主机路径，不能改为 Docker 命名卷，因为项目运行容器需要由
Docker Engine 直接访问该路径。

## 验证与升级

访问 `https://CONSOLE_HOST/api/health`，再登录控制台上传并运行一个测试项目。项目地址使用
`<项目名>-worker.PROJECTS_BASE_DOMAIN` 或 `<项目名>-pages.PROJECTS_BASE_DOMAIN`。

应用代码版本在 **设置 > 应用版本** 中选择已签名的 GitHub Release；失败会自动阻止切换并保留回滚点。
Node、Wrangler、Caddy 或系统依赖变化时，改用新的 Docker 镜像 SemVer。始终保留 `CCFWP_DATA_DIR`，
否则会丢失管理员、项目、资源和发行快照数据。

## 常见问题

- 证书失败：检查 DNS 记录、Cloudflare Token 的 Zone 范围，以及 UDP 443 是否放行。
- `403 trusted-ingress`：确认 Caddy 和 Manager 使用完全相同的 `INGRESS_PROXY_TOKEN`。
- 项目 404：确认项目正在运行，并使用项目名、类型和 `PROJECTS_BASE_DOMAIN` 组成的完整域名。
- 容器无法启动：确认镜像仓库可访问，且 `CCFWP_IMAGE_TAG` 是已存在的 `vX.Y.Z` 标签。
