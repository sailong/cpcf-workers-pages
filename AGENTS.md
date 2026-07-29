# Repository Guidelines

## Project Structure & Module Organization

`manager/server.js` is the Express entry point; keep handlers in `manager/routes/`, request logic in `manager/middleware/`, operations in `manager/services/`, and shared helpers in `manager/utils/`. The React/TypeScript application lives in `manager/client/src/`, with UI under `components/`, screens under `pages/`, and API wrappers under `services/`. Cloudflare helper Workers belong in `manager/system-workers/`. Browser tests are in `tests/e2e/`; backend verification scripts are in `manager/tests/`. Deployment notes live in `docs/`, while `examples/` contains reference projects.

Do not hand-edit generated or local-state directories such as `.platform-data/`, `.wrangler/`, `manager/client/dist/`, `test-results/`, or `playwright-report/`.

## Build, Test, and Development Commands

- `docker compose -f docker-compose.dev.yml up --build` builds and runs the complete development stack on port 8001.
- `cd manager && npm install && npm start` starts Express directly.
- `cd manager/client && npm install && npm run dev` starts the Vite frontend; `npm run build` performs a TypeScript check and production build.
- `cd manager/client && npm run lint` runs ESLint over TypeScript and React code.
- `cd tests/e2e && npm install && npm test` runs Playwright against `http://localhost:8001`. Use `npm run test:headed` for debugging.

## Coding Style & Naming Conventions

Match nearby code: backend CommonJS JavaScript generally uses four-space indentation, while frontend TypeScript/TSX uses two spaces. Use `camelCase` for functions and variables, `PascalCase` for React components and types, and kebab-case for backend module files such as `project-service.js`. Keep route handlers thin and move reusable behavior into services or utilities. Frontend changes must satisfy the repository ESLint configuration and strict TypeScript checks.

## Testing Guidelines

Name browser tests `*.spec.js` and group related flows with `test.describe`. Add or update Playwright coverage for user-visible flows, authentication, routing, and resource management. Run the relevant `manager/tests/verify_*.js` script for backend binding or rebuild changes. There is no coverage threshold; changed behavior still requires regression coverage.

## Commit & Pull Request Guidelines

History follows Conventional Commits, commonly `feat(scope):`, `fix(scope):`, `refactor(scope):`, `style(scope):`, `docs:`, and `chore:`. Keep each commit focused. Pull requests should explain behavior and configuration impact, link relevant issues, list verification commands, and include screenshots for UI changes. Call out changes to ports, bindings, persistent data, or deployment files.

## Security & Agent Notes

Never commit `.env`, credentials, tokens, or `.platform-data/` contents; avoid logging secret values. When `.codegraph/` is present, use CodeGraph first for code discovery and call-path analysis. Do not rebuild its index unless explicitly requested.
