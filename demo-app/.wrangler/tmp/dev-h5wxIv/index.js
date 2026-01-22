var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-pDU6pf/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/ui.ts
var html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare Docker Demo</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: '#F38020', // Cloudflare Orange
                    }
                }
            }
        }
    <\/script>
</head>
<body class="bg-gray-900 text-white min-h-screen font-sans">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <header class="mb-10 text-center">
            <h1 class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-yellow-500 mb-2">
                Cloudflare Docker Demo
            </h1>
            <p class="text-gray-400">Local Development Environment for Workers, D1 & KV</p>
        </header>

        <div class="grid md:grid-cols-2 gap-8">
            <!-- KV Section -->
            <section class="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                <div class="flex items-center mb-4">
                    <div class="p-2 bg-blue-500/20 rounded-lg mr-3 text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                    </div>
                    <h2 class="text-xl font-semibold">Workers KV</h2>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Key</label>
                        <input type="text" id="kv-key" placeholder="e.g., config_setting" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand focus:outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Value</label>
                        <input type="text" id="kv-value" placeholder="e.g., enabled" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand focus:outline-none transition-all">
                    </div>
                    
                    <div class="flex gap-2 pt-2">
                        <button onclick="setKV()" class="flex-1 bg-brand hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                            Set Value
                        </button>
                        <button onclick="getKV()" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors border border-gray-600">
                            Get Value
                        </button>
                    </div>

                    <div class="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-700 min-h-[60px]">
                        <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Result</div>
                        <div id="kv-result" class="font-mono text-green-400 text-sm break-all"></div>
                    </div>
                </div>
            </section>

            <!-- D1 Section -->
            <section class="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700">
                <div class="flex items-center mb-4">
                    <div class="p-2 bg-purple-500/20 rounded-lg mr-3 text-purple-400">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                    </div>
                    <h2 class="text-xl font-semibold">D1 Database (SQLite)</h2>
                </div>

                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Name</label>
                            <input type="text" id="db-name" placeholder="John Doe" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1">Email</label>
                            <input type="email" id="db-email" placeholder="john@example.com" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all">
                        </div>
                    </div>
                    
                    <div class="flex gap-2 pt-2">
                        <button onclick="addUser()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                            Add User
                        </button>
                        <button onclick="fetchUsers()" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors border border-gray-600">
                            Refresh List
                        </button>
                    </div>

                    <div class="mt-4">
                        <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">User List</div>
                        <div class="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                            <ul id="db-list" class="divide-y divide-gray-800 max-h-[200px] overflow-y-auto">
                                <li class="p-3 text-center text-gray-500 text-sm">Loading...</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </div>
        
        <footer class="mt-12 text-center text-gray-600 text-sm">
            <p>Running in Docker \u2022 emulate Cloudflare Workers Environment</p>
        </footer>
    </div>

    <script>
        // KV Functions
        async function getKV() {
            const key = document.getElementById('kv-key').value;
            if (!key) return showToast('Please enter a key', 'error');
            
            try {
                const res = await fetch(\`/api/kv?key=\${key}\`);
                const data = await res.json();
                document.getElementById('kv-result').innerText = data.value !== null ? data.value : '(null)';
            } catch (e) {
                document.getElementById('kv-result').innerText = 'Error fetching KV';
            }
        }

        async function setKV() {
            const key = document.getElementById('kv-key').value;
            const value = document.getElementById('kv-value').value;
            if (!key || !value) return showToast('Please enter key and value', 'error');

            try {
                await fetch('/api/kv', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value })
                });
                document.getElementById('kv-result').innerText = 'Valid saved!';
                showToast('Value saved successfully');
            } catch (e) {
                showToast('Error saving value', 'error');
            }
        }

        // D1 Functions
        async function fetchUsers() {
            const list = document.getElementById('db-list');
            try {
                const res = await fetch('/api/db');
                const users = await res.json();
                
                list.innerHTML = users.length ? users.map(u => \`
                    <li class="p-3 hover:bg-gray-800/50 transition-colors flex justify-between items-center group">
                        <div>
                            <div class="font-medium text-gray-200">\${u.name}</div>
                            <div class="text-xs text-gray-500">\${u.email}</div>
                        </div>
                        <div class="text-xs text-gray-600 font-mono">ID: \${u.id}</div>
                    </li>
                \`).join('') : '<li class="p-3 text-center text-gray-500 text-sm">No users found</li>';
            } catch (e) {
                list.innerHTML = '<li class="p-3 text-center text-red-400 text-sm">Error loading users</li>';
            }
        }

        async function addUser() {
            const name = document.getElementById('db-name').value;
            const email = document.getElementById('db-email').value;
            
            if (!name || !email) return showToast('Please fill all fields', 'error');

            try {
                const res = await fetch('/api/db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email })
                });
                
                if (res.ok) {
                    document.getElementById('db-name').value = '';
                    document.getElementById('db-email').value = '';
                    fetchUsers();
                    showToast('User added successfully');
                } else {
                    const err = await res.text();
                    showToast(err, 'error');
                }
            } catch (e) {
                showToast('Error adding user', 'error');
            }
        }

        // Utils
        function showToast(msg, type = 'success') {
            // Simple alert for now, can be upgraded to custom toast
            // console.log(type.toUpperCase() + ": " + msg);
            // Using a temporary visual indicator could be nice but alert is intrusive.
            // Let's just rely on UI updates for now or simple status text.
        }

        // Init
        fetchUsers();
    <\/script>
</body>
</html>
`;

// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response(html, {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }
    if (url.pathname === "/api/kv") {
      if (request.method === "GET") {
        const key = url.searchParams.get("key");
        if (!key) return Response.json({ error: "Missing key" }, { status: 400 });
        const value = await env.KV.get(key);
        return Response.json({ key, value });
      }
      if (request.method === "POST") {
        try {
          const body = await request.json();
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
    if (url.pathname === "/api/db") {
      if (request.method === "GET") {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
          return Response.json(results);
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500 });
        }
      }
      if (request.method === "POST") {
        try {
          const body = await request.json();
          if (!body.name || !body.email) {
            return Response.json({ error: "Missing name or email" }, { status: 400 });
          }
          const result = await env.DB.prepare(
            "INSERT INTO users (name, email) VALUES (?, ?)"
          ).bind(body.name, body.email).run();
          return Response.json({ success: true, result });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500 });
        }
      }
    }
    if (url.pathname === "/env") {
      return Response.json(process.env);
    }
    return new Response("Not Found", { status: 404 });
  }
};

// ../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../usr/local/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-pDU6pf/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../usr/local/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-pDU6pf/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
