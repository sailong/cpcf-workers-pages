# Public Local Cloudflare Platform Implementation Plan

## Product Decisions

- The manager is internet-facing and has exactly one administrator.
- Uploaded source and `package.json` are trusted, but projects must still be isolated from one another and from manager secrets.
- The platform emulates Workers and Pages locally; it does not deploy to Cloudflare.
- New uploads activate immediately after a successful build, with one-click rollback to the prior immutable release.
- Deleted KV, D1, and R2 resources enter a 30-day trash. Restore does not restore project bindings, and names remain reserved until permanent purge.
- Compatibility targets Wrangler/workerd Worker APIs. Distributed edge behavior such as KV global eventual consistency is explicitly out of scope.
- Project routes derive from an administrator-confirmed console host and projects base domain. Wildcard DNS and DNS-01 certificate issuance require a configured DNS provider.
- Every build and runtime receives explicit CPU, memory, PID, disk, upload, concurrency, and duration limits.

## Phase 0: Documentation Discovery (Complete)

### Allowed APIs and references

- Pin a repository-local Wrangler version and use documented Workers `dev` and Pages `pages dev` arguments: [Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/), [Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/), and [local data](https://developers.cloudflare.com/workers/development-testing/local-data/).
- Use documented D1 prepared statements/migrations, KV TTL/metadata/cursor behavior, R2 Worker methods, and Pages Functions context APIs.
- Use `better-sqlite3` transactions and WAL for control-plane metadata. Use Node `crypto.randomUUID()`, SHA-256, AES-256-GCM, and `fs/promises.rename()` for identifiers, secrets, and atomic activation.
- Use Docker Engine resource constraints (`Memory`, `NanoCpus`, `PidsLimit`, read-only rootfs, dropped capabilities, `no-new-privileges`) behind a narrow runtime broker: [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/).
- Use Caddy wildcard DNS-01 certificates for a fixed projects base domain: [automatic HTTPS](https://caddyserver.com/docs/automatic-https) and [TLS directive](https://caddyserver.com/docs/caddyfile/directives/tls).

### Verified current patterns to retain

- Binding TOML generation: `manager/utils/generator.js:22-61`.
- Pages binding argument assembly: `manager/utils/spawner.js:107-187`.
- Upload limit structure: `manager/middleware/upload.js:102-110`.
- Existing WebSocket proxy headers: `docs/1panel.md`.

### Global anti-pattern guards

- No unpinned `npx wrangler`, `shell: true`, inherited manager environment, shared writable project directory, or shared unrestricted network namespace.
- No direct JSON overwrite as the authoritative metadata store.
- No paths derived from request data without root-containment validation.
- No delete-before-copy deployments, restoration of old bindings, unrestricted `Host` inference, or unrestricted on-demand TLS.
- Do not claim Cloudflare edge-cache, geographic consistency, or exact CPU-time equivalence from a single-host emulator.

## Phase 1: Public Manager Security Baseline

### What to implement

1. Add an awaited bootstrap path before Express listens. Replace answer-bearing captcha JWTs with server-side, one-use, expiring challenges.
2. Replace seven-day localStorage bearer authentication with opaque server sessions stored as hashes and delivered through `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Increment a session version and revoke existing sessions on password change.
3. Add bounded login/IP rate limiting, strict JSON body limits, security headers, same-origin CORS, trusted-proxy configuration, and allowlisted console/project hosts.
4. Replace project-ID-derived AES-CBC secrets with a persisted mode-0600 master key and versioned AES-256-GCM payloads; migrate legacy ciphertext on successful read.
5. Add a shared `resolveWithin(base, value)` helper. Apply it to build IDs, output directories, project paths, deploy cleanup, and file routes.
6. Preflight ZIP entries before extraction: normalized path containment, entry count, expanded byte limit, compression-ratio limit, and rejection of links/special files. Upgrade vulnerable dependencies.

### Documentation references

- Existing auth surfaces: `manager/routes/auth.js`, `manager/services/auth-service.js`, `manager/middleware/auth.js`, `manager/server.js`.
- Existing path/build surfaces: `manager/routes/build.js:28-99`, `manager/routes/projects.js:388-463`, `manager/routes/files.js:15-63`.
- Node crypto and filesystem APIs only; do not invent token or archive APIs.

### Verification checklist

- Isolated tests prove captcha tokens contain no answer, challenges are one-use, login is rate-limited, cookies have all required attributes, and password change revokes prior sessions.
- Tests prove `../`, absolute paths, encoded traversal, sibling-prefix paths, and malicious ZIP entries cannot escape their roots.
- Legacy secret migration round-trips and tampering fails authentication.
- `npm audit`, backend tests, frontend TypeScript, lint baseline, and `git diff --check` are recorded.

### Anti-pattern guards

- Do not store raw sessions, captcha answers, or the master key in responses/logs.
- Do not treat CORS as authentication or trust arbitrary `X-Forwarded-Host`.
- Do not extract first and validate later.

## Phase 2: Transactional Control Plane and Trash

### What to implement

1. Add `manager/services/database.js` and monotonic migrations using `PRAGMA user_version`, WAL, foreign keys, and transactions.
2. Model projects, resources, project bindings, deployments, sessions, audit events, and settings in SQLite. Import existing JSON once, retaining read-only backup files until verified.
3. Make resource DELETE a transactional soft delete: set `deleted_at` and `purge_after`, remove every binding, stop exposing the resource, and reserve `(kind, name)`.
4. Add trash list, restore, and permanent purge APIs. Restore only the resource record and stored data; never restore bindings. Add a 30-day purge job with audit records.
5. Replace `Date.now()` identifiers with `crypto.randomUUID()` and eliminate direct array mutation APIs.

### Documentation references

- Current metadata: `manager/services/project-service.js`, `manager/services/resource-service.js`, and `manager/routes/resources-{kv,d1,r2}.js`.
- [SQLite transactions](https://www.sqlite.org/transactional.html), [SQLite WAL](https://www.sqlite.org/wal.html), and the installed `better-sqlite3` API.

### Verification checklist

- Migration tests cover empty install, existing JSON import, interrupted import, corrupt JSON, and repeat startup.
- Transaction tests prove delete removes bindings atomically, names remain blocked in trash, restore leaves bindings empty, and purge releases names.
- Tests use temporary directories/databases only; no real `.platform-data` mutations.

### Anti-pattern guards

- No coordination across separate JSON writes, silent reset after parse failure, or physical data deletion before the transaction commits.
- Do not depend on Wrangler's private state layout without a pinned-version round-trip fixture.

## Phase 3: Immutable Releases and Immediate Rollback

### What to implement

1. Store releases under `.platform-data/projects/<project-id>/releases/<release-id>/`; stage under `staging/<release-id>/`.
2. Validate and hash the completed release, then atomically activate its database pointer. Keep the prior release immutable and addressable.
3. Make upload activation immediate only after build and health checks succeed. Add list and one-click rollback APIs; rollback activates the previous release and restarts the runtime.
4. Preserve build/deploy logs as structured deployment events and bound retention by policy.

### Documentation references

- Current destructive flow: `manager/routes/projects.js:259-463`.
- Node `fs/promises.rename()` and `crypto.createHash('sha256')`.

### Verification checklist

- Failure injection proves an interrupted build/deploy leaves the active release untouched.
- Two deployments followed by rollback serve the first version and retain immutable checksums.
- Concurrent deployment attempts serialize per project.

### Anti-pattern guards

- Never clear the active source/dist before replacement is verified.
- Never mutate or rebuild an existing release in place.

## Phase 4: Runtime Broker, Isolation, and Quotas

### What to implement

1. Introduce a runtime-provider interface and a narrow broker service that alone accesses the Docker Engine. The manager never passes arbitrary Docker options and project containers never receive the Docker socket.
2. Build a pinned Wrangler runtime image. Run every build and project in separate containers with a project network, minimal environment, non-root UID, read-only rootfs, dropped capabilities, no-new-privileges, PID/CPU/memory limits, and bounded writable mounts.
3. Bind runtimes to internal interfaces only. Route traffic through the manager/Caddy entrypoint and replace `fuser`/port killing with broker-owned container lifecycle.
4. Enforce upload/build duration in the manager, request concurrency in the proxy, and hard disk quota only when the host storage driver/filesystem confirms support. Refuse public production startup when mandatory isolation capabilities are unavailable.
5. Mount only the active release and explicitly bound resource state. Build containers never receive resource state or manager secrets.

### Documentation references

- Current runtime: `manager/utils/spawner.js`, `manager/services/runtime-service.js`, Dockerfile and Compose files.
- Docker Engine container creation/resource constraints and default seccomp documentation.

### Verification checklist

- An isolation fixture cannot read another project's release/state, manager secrets, Docker socket, or unbound resources; it cannot bind arbitrary host ports.
- CPU, memory, PID, request concurrency, upload size, build timeout, and supported disk limits each have deterministic rejection tests.
- Runtime cleanup removes only broker-owned containers and networks.

### Anti-pattern guards

- No Docker socket mount in project containers, full manager environment inheritance, host networking, privileged mode, or shell command construction.
- Do not describe directory-size polling as a hard disk quota.

## Phase 5: Wrangler Compatibility and Resource Semantics

### What to implement

1. Pin one Wrangler/workerd version in the platform runtime and expose project-level `compatibility_date` and documented flags.
2. Build conformance fixtures for Workers fetch, Pages Functions, D1 statements/batch/migrations, KV strings/TTL/metadata/cursor pagination, and R2 head/get/put/delete/list/multipart.
3. Fix D1 async handling and replace shared config/query files with request-scoped files. Align R2 IDs/names and define one canonical state source for each resource kind.
4. Label local-only deviations, especially KV geographic eventual consistency, in the UI and documentation.

### Documentation references

- Cloudflare D1, KV, R2, Pages Functions, Wrangler, and local-data documentation captured in Phase 0.
- Canonical helpers: `manager/services/resource-runtime.js`, `manager/services/resource-gateway-server.js`, and `manager/utils/d1-helper.js`.

### Verification checklist

- Conformance suite snapshots documented method signatures and representative return shapes.
- Concurrent D1 requests cannot cross database/config/query files.
- Trash/restore/purge round-trips preserve each resource kind on the pinned runtime.

### Anti-pattern guards

- Do not let uploaded projects choose the platform Wrangler version.
- Do not claim full compatibility from CRUD-only manager APIs.

## Phase 6: Domain Routing and Automatic TLS

### What to implement

1. Add explicit `CONSOLE_HOST` and `PROJECTS_BASE_DOMAIN` settings. During secure onboarding, propose values from the current trusted host and require administrator confirmation before persistence.
2. Route only exact `<slug>-worker.<base>` and `<slug>-pages.<base>` hosts mapped to known running projects. Honor forwarding headers only from configured trusted proxies.
3. Ship Caddy configuration generation for `console.<domain>` plus `*.apps.<domain>`, DNS-01 provider credentials supplied as secrets, certificate renewal status, and health diagnostics.
4. When DNS provider or wildcard records are unavailable, present actionable setup status rather than silently issuing per-host certificates.

### Documentation references

- Current proxy: `manager/middleware/proxy.js` and `docs/1panel.md`.
- Caddy automatic HTTPS/TLS documentation from Phase 0.

### Verification checklist

- Host-routing tests reject arbitrary suffixes, spoofed forwarding headers, unknown/stopped projects, and slug collisions.
- Staging ACME/DNS fixtures verify wildcard configuration without consuming production certificates.

### Anti-pattern guards

- No arbitrary Host-derived persisted domain, unrestricted on-demand TLS, or certificate issuance without an allowlist.

## Phase 7: Professional Operations Console

### What to implement

1. Replace the page/card navigation with a persistent responsive shell: Projects, Deployments, Resources, Trash, Settings.
2. Make Projects a dense table with status, type, active release, route health, CPU/memory/disk, bindings, last deployment, error summary, and efficient row actions.
3. Add project detail tabs: Overview, Deployments, Bindings, Logs, Settings. Surface immediate deployment progress and a clear rollback-to-previous action.
4. Add resource search, pagination, capacity summaries, binding visibility, bulk-safe operations, trash countdown, restore, and permanent purge confirmations.
5. Replace `alert/confirm` and isolated toast implementations with accessible dialogs, a shared notification system, retryable error states, skeletons, empty states, and an operation center.
6. Make login show manager health, captcha loading/retry, rate-limit feedback, password visibility, first-login password change, and keyboard/screen-reader semantics.

### Documentation references

- Current routes/components: `manager/client/src/App.tsx`, `pages/Dashboard.tsx`, `pages/Resources.tsx`, `pages/CreateProject.tsx`, `components/IDE/*`.
- Retain React/Vite/Tailwind and the current translation system; use the existing theme variables as migration inputs, not as a requirement to preserve glassmorphism.

### Verification checklist

- ESLint and TypeScript pass with no ignored errors. Component tests cover error/loading/empty/destructive states.
- Playwright uses isolated fixtures, semantic locators, no hard-coded default password/captcha decoding, and covers desktop/mobile core workflows without fixed sleeps.
- Visual QA confirms no overlap, clipped controls, unreadable contrast, or layout shift at supported viewports.

### Anti-pattern guards

- No nested decorative cards, emoji-only controls, hidden server failures, browser-native destructive dialogs, or oversized low-density dashboard cards.

## Final Verification Phase

1. Re-read the pinned Wrangler, Docker, SQLite, and Caddy documentation used by the implementation and verify exact signatures/options.
2. Search for banned patterns: `shell: true`, unpinned `npx wrangler`, shared unrestricted persistence, raw session/captcha secrets, unsafe joins, direct metadata JSON writes, `alert(`, and `confirm(`.
3. Run isolated backend/unit/integration/conformance suites, frontend lint/type/build, Playwright fixture suite, dependency audit, container isolation tests, and `git diff --check`.
4. Produce a deployment readiness report that distinguishes application-complete work from external prerequisites: host cgroup/quota support, DNS provider credentials, wildcard DNS, and ACME reachability.
