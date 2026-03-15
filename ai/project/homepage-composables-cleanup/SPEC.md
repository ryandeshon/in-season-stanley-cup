# SPEC: homepage-composables-cleanup

## Summary
Refactor `src/pages/HomePage.vue` by moving orchestration logic into dedicated composables (`useCupGameState`, `useLiveGameFeed`, `useUpcomingMatchups`) so the page is primarily presentational and easier to maintain.

## Problem
- `HomePage.vue` owns multiple responsibilities: game-state orchestration, websocket/polling lifecycle, and matchup schedule transforms.
- This coupling makes behavior-risky edits harder and increases regression risk.
- Frontend and test work is impacted because the baseline page logic is difficult to isolate.

## Goals
- Extract core orchestration into the three composables named in issue `#17`.
- Preserve current behavior and routing.
- Document composable responsibilities and input/output contracts.

## Non-Goals
- No visual redesign of the homepage.
- No API contract or backend behavior changes.

## Constraints
- Keep existing Cypress homepage scenarios passing.
- Maintain current data-test selectors and route links.
- Keep fallback behavior stable during upstream API/socket failures.

## Technical Design
- `src/composables/useCupGameState.js`: champion + active game state, game update transforms, avatar-state logic, and winner/loser derivation.
- `src/composables/useLiveGameFeed.js`: websocket integration, stale polling fallback, champion refresh interval, visibility refresh.
- `src/composables/useUpcomingMatchups.js`: possible/conditional matchup schedule loading and derived UI headings.
- `src/pages/HomePage.vue`: consume composables, keep existing template behavior, and wire lifecycle callbacks.
- `docs/homepage-composables.md`: document responsibilities and expected inputs/outputs.

## Risks and Mitigations
- Risk: Behavior regression due to extracted side effects ordering.
  - Mitigation: Keep logic flow identical and run lint + Cypress homepage regression suite.
- Risk: Timer/listener leaks after extraction.
  - Mitigation: Encapsulate cleanup in composable `onBeforeUnmount` hooks.

## Acceptance Criteria
1. Given the homepage is loaded, `HomePage.vue` no longer contains full game/socket/matchup orchestration internals.
2. Given existing homepage scenarios, behavior matches current baseline.
3. Given local quality checks run, lint and tests pass.

## Verification Plan
- `npm run lint`
- `npm run test:e2e` (or at least homepage scenario set)
- Manual smoke: off-day and game-day page states render with expected cards/tables.

## Rollback Plan
- Revert this branch/PR (`isc-017-homepage-composables`) to restore previous single-file orchestration in `HomePage.vue`.
