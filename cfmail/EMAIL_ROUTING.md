# Cloudflare Email Routing to Self-Hosted Worker

Cloudflare Email Routing 目前仅支持将邮件转发到 **Cloudflare 托管的 Workers**，不支持直接 webhook 到外部 URL。为了将邮件转发到您的 **自建 Worker 服务**，我们需要搭建一个 "中继 (Relay)" 架构。

## 架构说明

1.  **Cloudflare Relay Worker**: 部署在 Cloudflare 上的一个极简脚本，负责接收邮件 -> 提取内容 -> 发送 POST 请求。
2.  **Self-Hosted Receiver**: 部署在您自建平台上的 Worker，负责接收 POST 请求 -> 处理业务逻辑。

---

## 第一步：部署 Cloudflare Relay Worker

登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，创建一个新的 Worker（例如命名为 `email-relay`）。

### 中继代码 (worker.js)

将以下代码复制到 Cloudflare Worker 编辑器中：

```javascript
/**
 * Cloudflare Email Routing Relay
 * 转发邮件到自建服务
 */

export default {
  async email(message, env, ctx) {
    // 1. 配置您的自建服务接收地址
    // 注意：必须是公网可访问的地址
    const TARGET_URL = "https://mail-processor-worker.ccfwp.241115.xyz/api/email/incoming";
    
    // 自定义验证 Token (可选，建议加上以防止滥用)
    const SECRET_TOKEN = "your-secure-token-here";

    try {
      // 2. 读取邮件内容
      const rawEmail = await new Response(message.raw).text();
      const from = message.from;
      const to = message.to;
      const headers = new Headers(message.headers);

      // 3. 构建转发 payload
      const payload = {
        from,
        to,
        headers: Object.fromEntries(headers),
        raw: rawEmail // 原始邮件内容
      };

      // 4. 发送到自建服务
      const response = await fetch(TARGET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Relay-Token": SECRET_TOKEN
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to forward email: ${response.status} ${errorText}`);
        message.setReject(`Forwarding failed: ${response.status}`);
      } else {
        console.log(`Email forwarded successfully to ${TARGET_URL}`);
      }
    } catch (e) {
      console.error(`Error processing email: ${e.message}`);
      message.setReject(`Internal Error: ${e.message}`);
    }
  }
};
```

**发布** 这个 Worker。

#### 方法 A：使用 Dashboard (官网手动部署)
1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  在左侧菜单点击 **Workers & Pages** -> **Create Application**。
3.  点击 **Create Worker**，随便起个名（比如 `email-relay`），点击 **Deploy** (此时它是一个 Hello World)。
4.  点击 **Edit code** 进入在线编辑器。
5.  **关键步骤**：
    *   将 `mail/relay/src/index.js` 的 **全部内容** 复制粘贴覆盖原有代码。
    *   (一定要包含我新加的 `fetch` 函数，否则会报 `No fetch handler` 错误)。
6.  点击右上角 **Save and deploy**。
7.  **配置变量**：
    *   返回 Worker 的详细页面 (退出编辑器)。
    *   点击 **Settings** -> **Variables and Secrets**。
    *   点击 **Add** 添加变量：
        *   `TARGET_URL`: 您的自建 Worker 地址（https://您的自建Worker域名/api/email/incoming），千万别漏了 /api/email/incoming。
        *   `RELAY_TOKEN`: 您的密钥 (建议点击 Encrypt)。
    *   点击 **Save and deploy**。

#### 方法 B：使用 Wrangler CLI (推荐)
如果您本地安装了 Node.js，可以使用我为您生成的 `wrangler.toml` 直接部署：

```bash
cd mail/relay
# 登录 Cloudflare
npx wrangler login
# 部署
npx wrangler deploy
# 设置密钥 (Secret)
npx wrangler secret put RELAY_TOKEN
```

---

## 第二步：配置 Email Routing 规则

1.  在 Cloudflare Dashboard 中进入您的域名页面。
2.  点击左侧菜单 **Email** -> **Routing**。
3.  如果未启用，点击 **Enable Email Routing**。
4.  进入 **Routes** 选项卡，点击 **Create rule**。
5.  **Custom address**:
    *   **Action**: `Send to a Worker`
    *   **Destination Worker**: 选择刚才创建的 `email-relay`。
    *   **Match**: `Catch-all` (或指定具体邮箱前缀)。
6.  保存规则。

---

## 第三步：部署自建接收 Worker

即使代码在我为您生成的 `mail/worker` 目录下，您也需要将其"安装"到您的自建平台中。

### 操作步骤

1.  登录您的自建平台 (例如 `http://localhost:3000` 或您的线上地址)。
2.  点击 **"新建 Worker"** -> **"上传模式"** (或者是 "Create New" -> "Upload Folder")。
3.  选择项目名称为 `mail-worker`。
4.  **上传代码**：
    *   将 `mail/worker/src/index.js` 的内容复制粘贴进去。
    *   或者如果支持文件夹上传，选择 `mail/worker` 目录。
5.  **配置绑定**：
    *   在绑定设置中，添加一个 **D1 Database** 绑定。
    *   变量名: `DB`。
    *   选择数据库: `mail-db` (如果还没有，请先在 D1 管理界面创建一个)。
6.  **配置变量**：
    *   添加环境变量 `RELAY_TOKEN`，值必须与 Cloudflare 端的保持一致。
7.  保存并启动。

> **💡 小贴士：如何生成安全的 RELAY_TOKEN**
> 
> 您可以在终端运行以下命令生成一个随机字符串：
> ```bash
> # 使用 OpenSSL (推荐)
> openssl rand -hex 32
> 
> # 或者使用 Node.js
> node -e "console.log(crypto.randomUUID())"
> ```

### 接收端代码 (backend)

```javascript
/*
 * Self-Hosted Email Processor
 * 接收来自 Cloudflare Relay 的邮件
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 仅允许 POST 请求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 验证路径
    if (url.pathname !== '/api/email/incoming') {
      return new Response('Not found', { status: 404 });
    }

    // 验证 Token (安全检查)
    const token = request.headers.get('X-Relay-Token');
    if (token !== 'your-secure-token-here') {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const data = await request.json();
      
      console.log(`Received email from: ${data.from}`);
      console.log(`Payload size: ${data.raw.length} bytes`);

      // TODO: 在这里处理您的业务逻辑
      // 例如：保存到 D1 数据库，或解析内容触发其他操作
      
      // 示例：解析邮件可能会用到 'postal-mime' 等库（需要自行安装）
      // const parser = new PostalMime();
      // const email = await parser.parse(data.raw);

      return new Response(JSON.stringify({ status: 'success' }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

## 注意事项

1.  **公网访问**: 您的自建 Worker 必须能通过公网访问（例如配置了自定义域名 `mail-processor-worker.ccfwp.241115.xyz`）。
2.  **安全性**: 务必更改示例中的 `your-secure-token-here`，防止恶意调用接口。
3.  **Body Size**: Cloudflare Workers 有 Request Body 大小限制（通常是 100MB），如果邮件过大可能会被截断或报错。一般文本邮件没有任何问题。
