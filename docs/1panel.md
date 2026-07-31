# Public Deployment with Automatic TLS

The production Compose stack includes Caddy and does not publish the Manager's internal port. Caddy obtains one certificate for the console host and one DNS-01 wildcard certificate for project hosts.

## DNS

Choose two explicit names, for example:

- Console: `console.example.com`
- Projects base: `apps.example.com`

Create an `A`/`AAAA` record for `console.example.com` and a wildcard record for `*.apps.example.com`, both pointing to the server. Project URLs use exactly one label, such as `demo-worker.apps.example.com` or `site-pages.apps.example.com`.

## Cloudflare Token

Create a scoped Cloudflare API token with `Zone:DNS:Edit` for only the relevant zone. Do not use the Global API Key. Caddy uses this token only for DNS-01 challenges.

## Configuration

Create the deployment environment from `.env.production.example` and replace every placeholder. Generate the ingress secret with:

```bash
openssl rand -hex 32
```

The `CONSOLE_HOST`, `PROJECTS_BASE_DOMAIN`, `AUTH_PASSWORD`, `INGRESS_PROXY_TOKEN`, `ACME_EMAIL`, and `CLOUDFLARE_API_TOKEN` values are mandatory. Use the Let's Encrypt staging URL in `ACME_CA` while testing DNS to avoid production rate limits:

```text
https://acme-staging-v02.api.letsencrypt.org/directory
```

`.env.acme-staging.example` is the repository validation fixture. It proves Compose and Caddy variable wiring without contacting ACME or DNS. Replace its reserved example domains and placeholder token before an external staging issuance test; a successful local configuration check does not prove DNS permissions or public reachability.

## Start and Verify

```bash
docker compose --env-file .env.production up -d --build --wait
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs caddy
```

Only ports 80 and 443 should be publicly reachable. Ports 8001 and 9200 are internal; port 9100 is no longer used. Verify:

```bash
curl -I https://console.example.com/api/health
curl -I https://demo-worker.apps.example.com/
```

For 1Panel, deploy this Compose stack directly and allow inbound TCP 80/443 plus UDP 443. Do not add another public reverse proxy in front unless it preserves `Host`, supports WebSockets, and is explicitly added to `TRUST_PROXY`. Direct access to Manager is rejected in production without the private ingress token.

## Troubleshooting

- Certificate errors: confirm the token can edit the correct zone and wildcard DNS resolves publicly.
- HTTP 421: `CONSOLE_HOST` or `PROJECTS_BASE_DOMAIN` does not match the requested host.
- HTTP 403 trusted-ingress error: traffic bypassed Caddy or the two containers use different `INGRESS_PROXY_TOKEN` values.
- Project 404: the hostname must be `<project-name>-worker` or `<project-name>-pages`, and the project must be running.
