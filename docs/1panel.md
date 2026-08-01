# 1Panel 反向代理部署

这份方案适用于 1Panel 已经负责 HTTPS、证书和公网入口的服务器。1Panel 只需要把请求反向代理到
宿主机的 `127.0.0.1:38003`；项目容器不直接占用公网 80/443，也不启动 Caddy。Caddy 仍然打包在镜像中，
用于不依赖 1Panel 的标准 Docker 部署。反向代理必须注入 `X-CCFWP-Ingress-Token`，否则 Manager
会返回 `Request did not arrive through the trusted ingress`。

## 一、准备域名和目录

准备根域名和通配子域名 DNS 记录，并都指向服务器 IP。推荐使用同一个域名根：

- `example.com`：管理控制台，对应 `CONSOLE_HOST`。
- `*.example.com`：Workers 和 Pages 项目的通配域名，对应 `PROJECTS_BASE_DOMAIN=example.com`。

如果需要隔离控制台和项目域名，也可以使用 `console.example.com` 与 `*.apps.example.com`，但两个
域名仍然必须反代到同一个上游端口。

在 1Panel 中创建目录 `/opt/1panel/apps/ccfwp/data`，后续升级和回滚都必须保留这个目录。
为控制台域名和项目通配域名申请证书。可以使用一个同时包含这两个名称的证书，也可以分别申请证书。

## 二、创建编排

1. 打开 **容器 > 编排 > 创建编排**，名称填写 `ccfwp`。
2. 将仓库根目录 [`docker-compose.1panel.yml`](../docker-compose.1panel.yml) 的完整内容粘贴进去。
3. 可参考仓库根目录的 [`.env.1panel.example`](../.env.1panel.example) 填写 1Panel 环境变量面板；不要把 `latest` 用作镜像版本。
4. 保存并启动，等待 `ccfwp` 和 `ccfwp-updater` 都变为运行状态。

`.env.1panel.example` 只作为变量清单和示例，不要直接提交包含真实密码或 token 的副本。1Panel
编排编辑器中的环境变量值会用于 Compose 插值，变量名必须保持不变。

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `CCFWP_IMAGE_REPOSITORY` | `docker.io/simonchang/ccfwp-platform` | Docker Hub 镜像仓库 |
| `CCFWP_IMAGE_TAG` | `v1.2.4` | 严格 SemVer 镜像版本 |
| `CCFWP_MANAGER_HOST_PORT` | `38003` | 仅绑定本机的反代端口 |
| `CCFWP_DATA_DIR` | `/opt/1panel/apps/ccfwp/data` | 宿主机持久化目录 |
| `DOCKER_API_VERSION` | `v1.44` | Docker Engine API 版本，必须保留 `v` 前缀 |
| `CONSOLE_HOST` | `example.com` | 控制台域名 |
| `PROJECTS_BASE_DOMAIN` | `example.com` | 项目域名根；不要填写 `*.` |
| `AUTH_PASSWORD` | 随机强密码 | 管理员初始密码 |
| `INGRESS_PROXY_TOKEN` | `openssl rand -hex 32` | 反代可信请求凭证 |
| `CCFWP_UPDATER_TOKEN` | `openssl rand -hex 32` | 独立的升级器凭证 |
| `CCFWP_GITHUB_REPOSITORY` | `sailong/cpcf-workers-pages` | GitHub Release 仓库 |

生成两个不同的 token：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

第一个填入 `INGRESS_PROXY_TOKEN`，第二个填入 `CCFWP_UPDATER_TOKEN`。不要提交 `.env` 或在聊天中公开
这两个值。1Panel 模式不需要填写 `ACME_EMAIL` 和 `CLOUDFLARE_API_TOKEN`，证书由 1Panel 管理。
`CCFWP_DATA_DIR` 必须是宿主机绝对路径，不能填写 `./data`；项目运行容器需要 Docker Engine 直接访问
这个路径。编排已默认将 `DOCKER_API_VERSION` 设置为 `v1.44`，不要改成 `1.44`。

## 三、配置 1Panel 反向代理

分别为控制台域名和通配项目域名创建反向代理站点，两者的上游都填写：

```text
127.0.0.1:38003
```

代理设置必须满足：

- 保留原始 `Host`，不要改成容器名或 `127.0.0.1`。
- 开启 WebSocket。
- 转发 `X-Forwarded-Proto: https`。
- **必须**增加 `X-CCFWP-Ingress-Token: <与环境变量完全相同的 token>`；这是服务端到 Manager 的固定
  可信凭证，不是浏览器请求头。

如果 1Panel 使用一个站点同时承载根域名和通配子域名，请确保该站点的 Server Name 同时包含
`example.com` 和 `*.example.com`；如果拆成两个站点，两边都要配置同样的请求头。

如果 1Panel 提供 Nginx 自定义配置，可等价写成：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-CCFWP-Ingress-Token "填写同一个 INGRESS_PROXY_TOKEN";
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

不要再把 Caddy 映射到 `38003:8001`，也不要让 1Panel 反代到容器内的 `8002`。

## 四、验证和日常升级

浏览器访问 `https://example.com`，登录后上传并运行一个 Worker 或 Pages 项目，再访问：

```text
https://<项目名>-worker.example.com
https://<项目名>-pages.example.com
```

如果控制台能登录但项目返回 404，先检查通配 DNS、项目状态和原始 `Host` 是否保留。

应用代码升级在控制台的 **设置 > 应用版本** 中选择明确的 `vX.Y.Z` Release；数据库迁移 dry-run
失败时不会切换版本。镜像升级时只修改 `CCFWP_IMAGE_TAG` 并在 1Panel 重新部署，绝对不要修改
`CCFWP_DATA_DIR`。需要回退时改回上一个镜像 SemVer 并重新部署，应用版本则使用控制台的一键回滚。

## 常见故障

- `502`：确认编排已运行，且宿主机端口是 `127.0.0.1:38003`。
- `403 trusted-ingress` 或 `Request did not arrive through the trusted ingress`：检查 1Panel 是否在服务端
  注入 `X-CCFWP-Ingress-Token`，并确认它与 Manager 环境变量的 `INGRESS_PROXY_TOKEN` 完全一致；不要只在
  浏览器中添加请求头。
- `Cross-origin requests are not allowed`：检查 `Host`、`X-Forwarded-Proto` 和可信 token。
- HTTPS 重定向循环：确认 1Panel 方案没有启动 Caddy，且上游使用 HTTP 连接到 `127.0.0.1:38003`。
- `client version 1.41 is too old`：确认编排中 `ccfwp` 和 `ccfwp-updater` 都使用
  `DOCKER_API_VERSION=v1.44`，然后重新创建容器；不要删除持久化数据目录。
