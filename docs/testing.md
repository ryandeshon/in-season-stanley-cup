# End-to-end testing with Cypress

## Setup
- Use Node 20 for Cypress (`nvm use 20` if you have nvm installed).
- Install dependencies: `yarn install --frozen-lockfile` (or `npm ci`).
- Test env vars live in `.env.cypress` and are loaded automatically by `vue-cli-service serve --mode cypress`. Values point at local mock endpoints so the app never calls real services during tests.
- `.env.cypress` enables `VUE_APP_ENABLE_SEASON_CONTRACTS=true` so Cypress always exercises `/season/meta` and `/champion/history` paths.

## Commands
- `npm run test:e2e` (or `yarn test:e2e`) — headless CI run (spins up the dev server, stubs APIs, exits non-zero on failures).
- `npm run test:e2e:open` (or `yarn test:e2e:open`) — interactive Cypress runner (starts the dev server first).
- `npm run cy:serve` (or `yarn cy:serve`) — run the app with the cypress env/profile if you want to point Cypress at an already running server.
- `npm run test:unit` — composable unit test run with Vitest (no network dependencies).
- `npm run test:unit:watch` — watch mode for local unit test development.

## Fixtures & stubbing
- Fixtures live in `cypress/fixtures`:
  - `cup-day-multiple-games.json` — Cup defense plus extra games on the slate.
  - `cup-day-only.json` — only the Cup game is scheduled.
  - `no-games.json` — off day / off-season with upcoming matchups.
  - `no-games-empty-next.json` — off day with no next-defense games.
  - `no-games-next-error.json` — off day with schedule API failure.
  - `season-over.json` — backend metadata indicates season is over.
  - `api-error.json` — upstream failures for champion/game endpoints.
- Homepage tests call `cy.mockApiScenario(<fixtureName>)` (defined in `cypress/support/commands.js`) to intercept:
  - `VUE_APP_API_BASE` endpoints: `/season/meta`, `/champion/history`, `/champion`, `/gameid`, `/players`, `/game-records`
  - `VUE_APP_NHL_API_URL` endpoints: `/gamecenter/:id/boxscore`, `/schedule/:date`
- Draft tests call `cy.mockDraftScenario(<fixtureName>)` to intercept:
  - `VUE_APP_API_BASE` endpoints: `/players`, `/draft/state`, `/draft/select-team`, `/players/reset-teams`
- Add new scenarios by dropping a fixture and reusing the same shape (`championResponse`, `gameIdResponse`, `playersResponse`, `gameRecordsResponse`, `gameInfoResponse`, optional `championStatus`/`gameIdStatus`/`gameInfoStatus`/`scheduleStatus`, `scheduleResponse`).
- Matchup selector is constrained to the Cup game on game days.

## What is covered
- Homepage Cup matchup rendering (champion/challenger, live clock, View Game Details link).
- Matchup selector behavior (Cup game selected by default).
- Backend-driven season-over branch from `/season/meta`.
- Champion timeline rendering from `/champion/history`.
- "What's Next" panel states: data, empty, and error.
- Navigation into `/game/:id` and rendering of the boxscore tables.
- Off-day state (champion not defending, upcoming matchups table).
- Graceful handling when upstream APIs error.
- Draft participant flow (team selection + optimistic draft version patch payload).
- Draft admin controls (start, advance, reset) and disconnected socket warning.

## Check-game Lambda tests
- Unit tests for core finalization timing logic live in `lambdas/check-game/index.test.cjs`.
- Run with Node 22+:
  - `node --test lambdas/check-game/index.test.cjs`
- Covered behavior:
  - Final state detection (`FUT`/`LIVE`/`CRIT` vs `FINAL`/`OFF`).
  - Adaptive next-check interval selection.
  - EventBridge Scheduler `at(...)` expression formatting.

## Check-game regression scenarios
- Verify non-final games keep rechecking:
  - Confirm CloudWatch logs contain `decision":"reschedule"` and a `nextCheckAt`.
- Verify finalization writes exactly once:
  - Confirm logs contain `writeOutcome":"claimed"` once for a game ID.
  - Repeat invocation should log `writeOutcome":"duplicate"` and skip duplicate writes.
- Verify stale UI recovery:
  - Keep the home page open through a game final.
  - Confirm champion refreshes after final or tab refocus without manual hard reload.

## Amplify CI (test branch)
- Build spec: `amplify.yml` runs `test:e2e` only when `AWS_BRANCH=test`, then builds the app. Other branches skip Cypress but still build.
- The buildspec uses `yarn` when available and falls back to `npm` for install/test/build commands.
- Node version is pinned to 20 in the build commands to satisfy Cypress/start-server-and-test engines.

### AWS CLI examples
Keep the Amplify Console in sync with the repo build spec:
```bash
# Update the app to consume the committed build spec
aws amplify update-app --app-id <APP_ID> --build-spec file://amplify.yml

# Ensure the test branch uses the TEST stage (helpful for env scoping)
aws amplify update-branch --app-id <APP_ID> --branch-name test --stage TEST
```
If you change `amplify.yml`, re-run the `update-app` command so the console picks up the new Cypress step.

## Unit tests in GitHub Actions
- Workflow: `.github/workflows/unit-tests.yml`
- Runs on pull requests and pushes to `main`.
- Uses `npm ci` and executes `npm run test:unit`.
