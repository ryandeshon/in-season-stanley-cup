# SPEC: season-data-api-roadmap

## Summary
Implement the current high-priority season data/API roadmap tickets in dependency order, including backend contract work, frontend integration, automated tests, and operator documentation for future season rollovers.

## Problem
- Homepage season-over state was hardcoded and not driven by backend metadata.
- Draft updates had no optimistic concurrency protection.
- Champion history endpoint was missing.
- Test coverage did not include these new API contracts and UI states.
- Season rollover handling was partly manual and under-documented.

## Goals
- Deliver issues `#23`, `#35`, `#33`, `#38`, `#39`, and `#40` in one integrated change set.
- Add clear season data runbook documentation for future seasons.

## Non-Goals
- Full migration to a single DynamoDB table model in this PR.
- Reworking season branding assets beyond existing season1/season2 UI themes.

## Constraints
- Preserve existing frontend behavior for active season flows.
- Keep admin auth opt-in via environment configuration.
- Keep tests deterministic and fully stubbed.

## Technical Design
- Backend (`lambdas/http-api/index.js`):
  - Add dynamic season parsing (`seasonN`/`N`) and invalid season query handling.
  - Add `GET /champion/history?limit=<n>`.
  - Add optimistic concurrency for `PATCH /draft/state` using `version` + `409` conflict payload.
  - Add optional protected-route auth using `ADMIN_API_TOKEN` + `x-admin-token`.
- Frontend:
  - Source season-over state from `GET /season/meta`.
  - Add champion timeline rendering from `GET /champion/history`.
  - Add conflict-aware draft update handling in player/admin draft pages.
  - Add "What's Next" panel with data/empty/error states.
- Tests:
  - Add API contract/unit tests for new backend contracts and conflict/auth paths.
  - Expand Cypress coverage for homepage and draft flows.
- Docs:
  - Add `docs/season-data-runbook.md`.
  - Update `README.md` and `docs/testing.md`.

## Risks and Mitigations
- Risk: stale draft writes causing user confusion.
  - Mitigation: explicit `409` handling and latest-state refresh snackbar.
- Risk: season rollover mistakes in ops.
  - Mitigation: explicit runbook + env var conventions.
- Risk: test flakiness in draft/admin e2e paths.
  - Mitigation: deterministic Cypress fixtures/intercepts.

## Acceptance Criteria
1. Homepage season-over mode is derived from backend metadata.
2. Draft stale updates return `409` and frontend handles conflicts gracefully.
3. Champion history endpoint returns deterministic payload and validates `limit`.
4. API/unit and Cypress coverage includes new contracts and key UI states.
5. Season rollover and season-data handling are documented for future seasons.

## Verification Plan
- `npm run test:unit`
- `npm run lint`
- `npm run test:e2e`

## Rollback Plan
- Revert the branch/PR commit series.
- Restore previous Lambda package if deployment regression occurs.
- Remove new env vars (`DEFAULT_SEASON`, `PLAYERS_TABLE_SEASONN`, `GAME_RECORDS_TABLE_SEASONN`, `ADMIN_API_TOKEN`) if not needed.
