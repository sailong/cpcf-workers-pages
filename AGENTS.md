# Repository Guidelines

## Project Structure

`manager/server.js` starts Express. Keep HTTP handlers in `manager/routes/`, middleware in `manager/middleware/`, domain operations in `manager/services/`, and shared helpers in `manager/utils/`. React/TypeScript code is under `manager/client/src/` (`components/`, `pages/`, and `services/`). Backend tests live in `manager/tests/`; Playwright tests live in `tests/e2e/`. Deployment notes are in `docs/`, with samples in `examples/`.

Do not hand-edit `.platform-data/`, `.wrangler/`, `manager/client/dist/`, `test-results/`, or `playwright-report/`.

## Development Commands

- `docker compose -f docker-compose.dev.yml up --build`: run the Docker-isolated development stack on port 8001.
- `cd manager && npm ci && npm test`: run backend unit and integration tests.
- `cd manager && npm run test:pages-runtime`: verify the local Pages runtime.
- `cd manager/client && npm ci && npm run dev`: start the Vite console; use `npm run build` to build.
- `cd manager/client && npm run lint && npm run typecheck`: run frontend lint and strict TypeScript checks.
- `./scripts/test-all.sh`: run non-browser tests, coverage, audits, build, and Compose validation.
- `./scripts/test-runtime-broker.sh`: exercise Docker network, filesystem, and D1/KV/R2 isolation.
- `./scripts/test-e2e.sh`: create a disposable stack on port 18001 and run Playwright.

## Style and Naming

Use four-space indentation in backend CommonJS JavaScript and two spaces in frontend TypeScript/TSX. Use `camelCase` for variables and functions, `PascalCase` for React components and types, and kebab-case for backend filenames. Keep routes thin; put reusable behavior in services. Frontend changes must pass ESLint and TypeScript.

## Testing Guidelines

Name browser tests `*.spec.js` and group flows with `test.describe`. Add regression coverage for authentication, uploads, immutable releases and rollback, resource trash/restore, routing, and project isolation. Frontend coverage thresholds are 80% statements/functions/lines and 70% branches for configured shared modules. Use temporary databases and data directories; never test destructive behavior against persistent development data.

## Commits and Pull Requests

Follow Conventional Commits such as `feat(scope):`, `fix(scope):`, `refactor:`, `docs:`, and `chore:`. Keep commits focused. Pull requests must describe behavior and configuration impact, link issues, list verification commands, and include screenshots for UI changes. Call out port, binding, persistent-data, or deployment changes.

## Security Notes

Never commit credentials, tokens, `.env` files, or platform state. Uploaded code and `package.json` are trusted by policy; installs still require a lockfile and `--ignore-scripts`, use the configured registry/network policy, and build scripts run on internal networks for reproducibility. Docker is the default runtime; process runtime requires explicit unisolated opt-in. When `.codegraph/` exists, use `codegraph explore` before grep or direct source reads, and do not rebuild its index unless requested.
