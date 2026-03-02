# SPEC: cypress-e2e-amplify-ci

## Summary
Establish a deterministic Cypress end-to-end test strategy for the In Season Cup app and enforce it in the Amplify test-branch pipeline so regressions block deployment.

## Problem
- The app lacked an end-to-end gate for key homepage/game flows.
- Behavior depends on external APIs, so unmocked tests are flaky.
- CI needed a branch-scoped test run that fails the build on test failures.

## Goals
- Add stable Cypress fixtures/stubs for key game-day states.
- Cover high-value homepage/game flows, including matchup selector spectator behavior.
- Ensure Amplify test branch runs Cypress headless and blocks failed builds.
- Document local workflow and Amplify CLI synchronization commands.

## Non-Goals
- Replace existing unit/integration test approaches.
- Change production API contracts.
- Add visual regression or performance testing in this phase.

## Constraints
- Keep tests deterministic with no live NHL/backend dependency.
- Preserve existing user-visible behavior outside the selector/spectator enhancement.
- Keep public docs scrubbed of sensitive account/resource IDs.

## Technical Design
- Cypress structure: `cypress/e2e`, `cypress/fixtures`, `cypress/support`.
- Reusable stubbing helper: `cy.mockApiScenario()` intercepts champion/game/players/game-records/boxscore/schedule calls.
- Fixture model includes:
  - baseline game-day response (`gameInfoResponse`)
  - optional alternate game payloads (`additionalGameInfoResponses`) keyed by game ID for matchup switching.
- Homepage enhancement:
  - add game-day matchup selector (default Cup game)
  - selecting non-Cup matchup drives spectator mode messaging.
- Amplify buildspec:
  - branch-gated `test:e2e` step for `AWS_BRANCH=test`
  - install/build command fallback for `yarn` or `npm`.

## Risks and Mitigations
- Risk: selector tests flaky due dynamic API timing.
  - Mitigation: wait on explicit Cypress aliases and use deterministic fixtures.
- Risk: CI environment differences (yarn availability).
  - Mitigation: buildspec fallback to npm.
- Risk: accidental live API calls.
  - Mitigation: broad endpoint intercepts for backend + NHL paths.

## Acceptance Criteria
1. Given Cypress config and scripts are present.
2. When developers run headed/headless E2E commands.
3. Then key homepage/matchup/spectator/error flows run deterministically from fixtures.
4. And Amplify test branch runs E2E and fails build on failures.

## Verification Plan
- Run `npm run test:e2e` locally.
- Spot-check interactive mode with `npm run test:e2e:open`.
- Validate `amplify.yml` branch gate and command execution paths.
- Review docs: `docs/testing.md`, `README.md`.

## Rollback Plan
- Revert `amplify.yml` test-step changes to prior build behavior.
- Revert homepage selector logic and Cypress test updates in one commit if regressions appear.
- Keep fixture and test scaffolding for future re-introduction if needed.
