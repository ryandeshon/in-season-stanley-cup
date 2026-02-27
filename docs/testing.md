# End-to-end testing with Cypress

## Setup
- Use Node 20 for Cypress (`nvm use 20` if you have nvm installed).
- Install dependencies: `yarn install --frozen-lockfile` (or `npm ci`).
- Test env vars live in `.env.cypress` and are loaded automatically by `vue-cli-service serve --mode cypress`. Values point at local mock endpoints so the app never calls real services during tests.

## Commands
- `npm run test:e2e` (or `yarn test:e2e`) — headless CI run (spins up the dev server, stubs APIs, exits non-zero on failures).
- `npm run test:e2e:open` (or `yarn test:e2e:open`) — interactive Cypress runner (starts the dev server first).
- `npm run cy:serve` (or `yarn cy:serve`) — run the app with the cypress env/profile if you want to point Cypress at an already running server.

## Fixtures & stubbing
- Fixtures live in `cypress/fixtures`:
  - `cup-day-multiple-games.json` — Cup defense plus extra games on the slate.
  - `cup-day-only.json` — only the Cup game is scheduled.
  - `no-games.json` — off day / off-season with upcoming matchups.
  - `api-error.json` — upstream failures for champion/game endpoints.
- Tests call `cy.mockApiScenario(<fixtureName>)` (defined in `cypress/support/commands.js`) to intercept:
  - `VUE_APP_API_BASE` endpoints: `/champion`, `/gameid`, `/players`, `/game-records`
  - `VUE_APP_NHL_API_URL` endpoints: `/gamecenter/:id/boxscore`, `/schedule/:date`
- Add new scenarios by dropping a fixture and reusing the same shape (`championResponse`, `gameIdResponse`, `playersResponse`, `gameRecordsResponse`, `gameInfoResponse`, optional `championStatus`/`gameIdStatus`/`gameInfoStatus`, `scheduleResponse`).

## What is covered
- Homepage Cup matchup rendering (champion/challenger, live clock, View Game Details link).
- Navigation into `/game/:id` and rendering of the boxscore tables.
- Spectator/off-day state (champion not defending, upcoming matchups table).
- Graceful handling when upstream APIs error.

## Amplify CI (test branch)
- Build spec: `amplify.yml` runs `yarn test:e2e` only when `AWS_BRANCH=test`, then builds the app. Other branches skip Cypress but still build.
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
