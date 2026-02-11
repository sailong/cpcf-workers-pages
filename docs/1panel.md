# 1Panel 部署指南 (支持自定义域名)

本文档将指导你如何在 1Panel 面板中部署 CCFWP 管理平台，并配置泛域名访问（例如 `*.ccfwp.example.com`）。

## 1. 准备工作

*   **1Panel 面板**: 已安装并运行正常的 1Panel。
*   **域名**: 一个你拥有的域名（例如 `example.com`）。
*   **DNS 解析**: 能够添加 DNS 记录。

## 2. DNS 解析配置 (关键)

为了让每个项目都能通过子域名访问（如 `my-app.worker.ccfwp.example.com`），你需要配置 **泛域名解析 (Wildcard DNS)**。

假设你想使用的根域名通过前缀是 `ccfwp.example.com`：

1.  登录你的域名服务商控制台。
2.  添加一条 **A 记录**：
    *   **主机记录 (Host)**: `*.ccfwp` (如果是直接用根域名则填 `*`)
    *   **记录值 (Value)**: 你的服务器 IP 地址
    *   **TTL**: 默认即可

> **注意**: 这样配置后，所有 `xxx.ccfwp.example.com` 的请求都会指向你的服务器。

## 3. 在 1Panel 中部署容器

1.  登录 1Panel，进入 **容器** -> **编排** -> **创建编排**。
2.  **名称**: `ccfwp-platform` (任意)
3.  **编辑器**: 粘贴以下 `docker-compose.yml` 内容：

```yaml
version: '3'
services:
  ccfwp-platform:
    image: yours/ccfwp:latest  # <--- 请替换为你构建或拉取的镜像名 (如果没有私有镜像，需先在本地构建并推送到 Docker Hub)
    container_name: ccfwp-platform
    ports:
      - "8001:8001" # 管理面板端口
      - "9100:9100" # R2 服务端口
    volumes:
      - ./data:/app/.platform-data
    environment:
      - NODE_ENV=production
      - MANAGER_SERVICE_PORT=8001
      - R2_ADMIN_PORT=9100
      # 【关键配置】设置为你的实际域名
      - ROOT_DOMAIN=ccfwp.example.com 
    restart: unless-stopped
```

4.  点击 **确认** 启动服务。

## 4. 配置反向代理 (Nginx)

容器启动后，你需要通过 1Panel 的 OpenResty (Nginx) 将域名请求转发给容器。

1.  进入 **网站** -> **创建网站**。
2.  **运行环境**: `反向代理`。
3.  **主域名**: `ccfwp.example.com`。
4.  **其他域名**: `*.ccfwp.example.com` (**这一步非常重要，必须添加泛域名**)。
5.  **代理地址**: `http://127.0.0.1:8001`。
6.  点击 **确认** 创建。

### 配置 WebSocket 支持

由于平台使用 WebSocket 进行热重载和状态通讯，你需要修改 Nginx 配置以支持 WS 协议。

1.  在网站列表中找到刚才创建的网站，点击 **配置**。
2.  进入 **反向代理** -> **配置文件** (或直接编辑网站的 Nginx 配置文件)。
3.  在 `location /` 块中确保包含以下 WebSocket 头配置：

```nginx
location ^~ / {
    proxy_pass http://127.0.0.1:8001; 
    proxy_set_header Host $host; 
    proxy_set_header X-Real-IP $remote_addr; 
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; 
    proxy_set_header REMOTE-HOST $remote_addr; 
    
    # WebSocket 支持 (必须)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    add_header X-Cache $upstream_cache_status; 
    #Set Nginx Cache
    
    # ... 其他默认配置
}
```

4.  保存并重载 Nginx。

## 5. 验证

1.  访问管理后台: `http://ccfwp.example.com` (如果配置了 HTTPS 则是 https)。
2.  创建一个测试 Worker 项目，名称为 `demo`。
3.  启动项目。
4.  点击 "打开应用"，浏览器应跳转至 `http://demo-worker.ccfwp.example.com` 并成功显示内容。

## 故障排查

*   **访问 404**: 检查 DNS 是否泛解析成功（ping `test.ccfwp.example.com` 是否指向服务器 IP）。
*   **Bad Gateway (502)**: 检查 1Panel 网站反代目标是否填写正确 (`http://127.0.0.1:8001`)。
*   **Worker 无法访问**: 检查 `ROOT_DOMAIN` 环境变量是否与你在 Nginx 绑定的域名一致。
*   **SSL 报错 (ERR_SSL_VERSION...)**:
    *   **关键检查**: 泛域名证书 **不支持多级子域名**。
        *   ❌ 错误: 证书是 `*.example.com`，访问域名是 `app.ccfwp.example.com` (三级子域名) -> **握手失败**。
        *   ✅ 正确 A: 申请 `*.ccfwp.example.com` 的证书。
        *   ✅ 正确 B: 将 `ROOT_DOMAIN` 改为 `example.com`，访问 `app-ccfwp.example.com` (二级子域名)。
    *   确保申请了 **泛域名证书** (例如 `*.ccfwp.example.com`)。
    *   注意：系统使用 **连字符** (`demo-worker`) 连接项目名和类型，这确保了所有子域名都是一级子域名，因此一张泛域名证书即可覆盖所有项目。
