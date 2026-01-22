import { html } from "./ui";

export interface Env {
  KV: KVNamespace;
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Root route - Serve UI
    if (url.pathname === "/") {
      return new Response(html, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    // API: KV
    if (url.pathname === "/api/kv") {
      // GET Value
      if (request.method === "GET") {
        const key = url.searchParams.get("key");
        if (!key) return Response.json({ error: "Missing key" }, { status: 400 });

        const value = await env.KV.get(key);
        return Response.json({ key, value });
      }

      // SET Value
      if (request.method === "POST") {
        try {
          const body = await request.json() as { key: string; value: string };
          if (!body.key || !body.value) {
            return Response.json({ error: "Missing key or value" }, { status: 400 });
          }
          await env.KV.put(body.key, body.value);
          return Response.json({ success: true, key: body.key, value: body.value });
        } catch (e) {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
      }
    }

    // API: D1 Database
    if (url.pathname === "/api/db") {
      // LIST Users
      if (request.method === "GET") {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
          return Response.json(results);
        } catch (e: any) {
          return Response.json({ error: e.message }, { status: 500 });
        }
      }

      // ADD User
      if (request.method === "POST") {
        try {
          const body = await request.json() as { name: string; email: string };
          if (!body.name || !body.email) {
            return Response.json({ error: "Missing name or email" }, { status: 400 });
          }

          const result = await env.DB.prepare(
            "INSERT INTO users (name, email) VALUES (?, ?)"
          )
            .bind(body.name, body.email)
            .run();

          return Response.json({ success: true, result });
        } catch (e: any) {
          return Response.json({ error: e.message }, { status: 500 });
        }
      }
    }

    // Env Demo
    if (url.pathname === "/env") {
      return Response.json(process.env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
