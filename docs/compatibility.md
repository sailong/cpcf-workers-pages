# Local Runtime Compatibility

This platform runs uploaded Workers and Pages projects locally. Compatibility is version-scoped to Wrangler `4.114.0` and Miniflare `4.20260722.0`; uploaded projects cannot replace those platform runtime versions.

## Covered Behavior

- Workers `fetch` handlers and Pages Functions run through the pinned Wrangler/workerd toolchain.
- Project `compatibility_date` and documented compatibility flags are applied to every runtime start.
- D1 supports prepared statements, `first`, `run`, `all`, `raw`, batches, SQL console operations, and ordered migration files. Migrations use Wrangler's `d1_migrations` schema and filename ordering; already-applied names are skipped.
- KV supports string/binary values, expiration TTL, metadata, prefix filtering, limits, and cursor pagination.
- R2 supports `head`, `get`, `put`, single/multiple delete, list pagination, ranges, metadata, HTTP metadata, and multipart create/upload/complete/abort.
- Deleting D1, KV, or R2 resources moves them to a 30-day trash. Restore preserves data but intentionally does not restore project bindings.

These contracts are exercised against the pinned local runtime by the backend conformance tests and the isolated Docker/Playwright test stack.

## Intentional Deviations

The platform is not a Cloudflare edge network. It does not reproduce KV geographic eventual consistency, multi-region replication, global propagation latency, edge cache topology, Cloudflare analytics, billing, account APIs, or production service limits. Local data is authoritative on this host and must be backed up with the platform state directory.

CPU, memory, disk, process, upload, concurrency, and build-duration limits are platform controls, not replicas of Cloudflare pricing-plan quotas. Strong process and resource isolation requires the Docker runtime provider; the process provider is for local development only.

D1 migrations are explicit and are never applied automatically during project deployment, matching the safety boundary of Wrangler's separate migration command. Apply selected `.sql` files from the D1 manager and review the confirmation before execution.

Automatic public domains and wildcard TLS additionally depend on external DNS records, DNS provider credentials, ACME reachability, and the configured Caddy ingress. A healthy application container alone does not prove those external prerequisites.
