/**
 * Cloudflare Email Routing Relay
 * 转发邮件到自建服务
 */

export default {
    /**
     * HTTP Handler (用于验证 Worker 是否在线)
     * 解决 "No fetch handler!" 报错
     */
    async fetch(request, env, ctx) {
        return new Response("Email Relay Worker is Online (Only accepts email events)", {
            status: 200,
            headers: { "Content-Type": "text/plain" }
        });
    },

    async email(message, env, ctx) {
        // 1. 获取配置变量
        const TARGET_URL = env.TARGET_URL;
        const RELAY_TOKEN = env.RELAY_TOKEN;

        if (!TARGET_URL) {
            console.error("Missing TARGET_URL configuration");
            message.setReject("Configuration Error: Missing Target URL");
            return;
        }

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
                raw: rawEmail
            };

            // 4. 发送到自建服务
            const response = await fetch(TARGET_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Relay-Token": RELAY_TOKEN || "" // 如果未配置 Token 则发送空字符串
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
