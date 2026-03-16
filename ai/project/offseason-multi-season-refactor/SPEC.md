# SPEC: offseason-multi-season-refactor

## Summary
Implement an offseason-only big-bang refactor from legacy per-season tables to a single multi-season data model, then prepare deployment/migration runbooks and safeguards for post-season rollout.

## Problem
- Legacy data model relies on separate season tables and manual season copy operations.
- Draft and game record handling are not consistently season-scoped across all backend paths.
- Frontend season selector is partially hardcoded.
- No one-shot migration tool exists for offseason cutover.

## Goals
- Move API and checker Lambda to:
  - `PlayerLifetime`
  - `PlayerSeason`
  - `GameRecordsV2`
  - `DraftState` (scoped by `draftId=seasonId`)
- Keep player stat semantics locked:
  - `championships` lifetime carry-over
  - `totalDefenses` lifetime carry-over
  - `titleDefenses` season-only reset
- Add season catalog endpoint-driven season options (`GET /season/options`).
- Add one-time migration script + runbook for offseason execution.
- Keep draft/team in-season mutation lock behavior active.

## Non-Goals
- In-season production rollout.
- Season branding/theme redesign beyond existing season1/season2 presentation.

## Constraints
- Merge only in offseason window with explicit gates.
- Preserve current frontend response shapes for `GET /players`, `GET /game-records`, and champion history.
- Migration must be idempotent enough for safe reruns during validation.

## Technical Design
- Backend `lambdas/http-api/index.js` reads/writes only new tables and merges season+lifetime rows for player responses.
- Backend `lambdas/check-game/index.js` writes finalized game records to `GameRecordsV2` and increments defenses in both season + lifetime tables.
- Frontend bootstraps season options via API; draft route access is gated by season metadata + completion state.
- Migration script snapshots legacy tables, backfills new tables, and optionally updates Lambda env vars for cutover.

## Risks and Mitigations
- Risk: data mismatch during migration.
  - Mitigation: pre-snapshot + parity checks + rollback path.
- Risk: accidental in-season draft mutations.
  - Mitigation: existing write-lock guard retained.
- Risk: contract drift between frontend and deployed API.
  - Mitigation: route/CORS verification checklist in runbook.

## Acceptance Criteria
1. API serves season data from new tables only.
2. Checker writes game outcomes to season-scoped game records and defense counters split by season/lifetime semantics.
3. Frontend season selector is API-driven from `GET /season/options`.
4. Draft routes are offseason-gated with read-only completed snapshot support during active season.
5. Migration script + runbook fully document offseason cutover, validation, and rollback.

## Verification Plan
- `npm run test:unit`
- `npm run lint`
- Manual migration dry run in AWS account with snapshot validation.

## Rollback Plan
- Restore legacy snapshots to original tables.
- Revert Lambda env vars to legacy table config.
- Redeploy previous Lambda package if cutover regression appears.
