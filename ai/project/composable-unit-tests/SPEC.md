# SPEC: composable-unit-tests

## Summary
Add deterministic unit tests for extracted homepage and draft composables so logic regressions are caught early without relying on live network dependencies.

## Problem
- Core homepage/draft behavior now lives in composables with multiple state transitions and side effects.
- Current coverage relies primarily on Cypress, which is slower and less targeted for composable logic branches.
- Socket/polling and matchup filtering regressions can slip in without focused unit coverage.

## Goals
- Add unit tests for:
  - `useCupGameState`
  - `useLiveGameFeed`
  - `useUpcomingMatchups`
  - `useDraftRealtime`
- Cover success and error branches with mocked dependencies.
- Ensure tests run in CI with no external network dependency.

## Non-Goals
- No behavior/UI changes to production code.
- No replacement of existing Cypress coverage.

## Constraints
- Keep test execution deterministic and isolated.
- Mock NHL/API/socket dependencies.
- Keep setup lightweight and compatible with the existing Vue CLI project.

## Technical Design
- Add Vitest + jsdom configuration with `@` alias support.
- Add unit scripts in `package.json`.
- Add tests under `tests/unit/`.
- Add GitHub Action workflow to run unit tests on PR and `main`.
- Update `docs/testing.md` with unit test commands and CI notes.

## Risks and Mitigations
- Risk: flaky timer-based tests.
  - Mitigation: use fake timers and explicit cleanup.
- Risk: module mock leakage across tests.
  - Mitigation: enable Vitest mock reset/restore and reset refs in `beforeEach`.

## Acceptance Criteria
1. Composable state transitions and error paths are covered by deterministic unit tests.
2. Tests run without external network calls.
3. Unit tests execute in CI.

## Verification Plan
- `npm run test:unit`
- `npm run lint`

## Rollback Plan
- Revert this branch to remove the unit test harness/workflow if it causes CI/runtime issues.
