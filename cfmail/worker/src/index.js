/**
 * Self-Hosted Email Processor
 * 接收来自 Cloudflare Relay 的邮件并存入数据库
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
        const EXPECTED_TOKEN = env.RELAY_TOKEN;

        if (EXPECTED_TOKEN && token !== EXPECTED_TOKEN) {
            return new Response('Unauthorized', { status: 401 });
        }

        try {
            const data = await request.json();
            const { from, to, headers, raw } = data;

            // 简单的 Message-ID 提取逻辑 (如果 headers 里没有，则生成一个)
            let messageId = headers['message-id'];
            if (!messageId) {
                messageId = crypto.randomUUID();
            }

            // 尝试从 raw content 中提取更准确的 Message-ID (可选优化)

            console.log(`Received email from: ${from} to: ${to}`);

            // 插入数据库
            // Schema: id, message_id, source, address, raw, metadata, created_at
            const stmt = env.DB.prepare(
                `INSERT INTO raw_mails (message_id, source, address, raw, metadata) VALUES (?, ?, ?, ?, ?)`
            );

            const result = await stmt.bind(
                messageId,
                from,
                to,
                raw,
                JSON.stringify(headers)
            ).run();

            if (result.success) {
                return new Response(JSON.stringify({ status: 'success', id: result.meta.last_row_id }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                throw new Error('Database insert failed');
            }

        } catch (e) {
            console.error("Error processing request:", e);
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};
