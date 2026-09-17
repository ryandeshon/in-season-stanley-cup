# Browser regression gate (#71)

## Run locally

Use Node 22 and Yarn, then `yarn install --frozen-lockfile` and `yarn test:e2e`.
`yarn test:e2e:open` opens the interactive runner. Both commands start and stop
the test app on port 8080; leave that port free.

The suite exercises 17 scenarios across draft, Home/game, player profile and
standings. It uses fixtures, not production data. It does not verify real database
writes, production authentication, or WebSocket delivery; those require the next
phase's contract/integration coverage.

## Why the old intercepts failed

Two failure modes were reproduced locally:

1. Vue CLI preserves existing process variables over `.env.cypress`. Amplify has
   app-level API/NHL/socket variables inherited by the test branch, so the old
   localhost-only assumptions did not hold.
2. Exact full-URL patterns such as `**/api/champion` do not match
   `/api/champion?season=season2`. Season, history-limit and cache-busting query
   parameters therefore escaped those stubs even with a local API base.

`scripts/test/serve-cypress.cjs` now enforces test settings only in the test server
process. Production build configuration is unchanged. Matchers in
`cypress/support/routes.js` use pathname separately from query strings, so a
champion request cannot accidentally capture champion history. Scenario stubs
register before visiting the app.

The support file rejects unstubbed requests; known external logo, font and
analytics resources are stubbed. A new request must have an explicit fixture
handler instead of falling through to a real API. Home scenarios fix the Date
clock to their fixture, while normal timers continue running. Draft player reads
reflect mutations, and reset handlers explicitly reply rather than forwarding.

Previously skipped pregame/final goal-scorer assertions were updated to the
already-shipped live-only display rule. No game behavior changed.

## CI and Amplify

`Browser Tests / browser-tests` runs on PRs and main, including intentionally
conflicting inherited API configuration. It saves `cypress/results/run.json` and
failure screenshots as an artifact. The process fails for test failures, zero
tests, pending/skipped tests, and (with `CYPRESS_requireFullSuite=true`) fewer than
17 tests. Targeted local spec runs can omit the full-suite environment flag.

The checker Node tests now run alongside the existing unit tests. Amplify uses
Node 22 too; browser tests run on its `test` branch or when an isolated validation
branch sets `RUN_BROWSER_TESTS=true`. That opt-in does not change production API
configuration. Main production deployment remains separate from validation.

Required merge checks should include `browser-tests` and `unit-tests`. Repository
protection settings must be verified independently from workflow success.

## Maintenance and rollback

- Keep fixtures representative of API contracts; mocked browser success alone
  cannot establish backend correctness.
- Keep action/result selectors independent of visual layout during redesign.
- Review the minimum suite count when intentionally replacing/removing cases.
- Investigate flakiness rather than adding broad retries or fixed waits.
- Revert the launcher/config/workflow change together if test tooling must roll
  back. Do not restore skipped suites as a successful release gate.
- No database migration or production data reset is part of this change.
