# Phase 2 review checkpoint

Review: [draft PR #75](https://github.com/ryandeshon/in-season-stanley-cup/pull/75).

Phase 1 was merged in #73. Phase 2 is based on that merge and addresses #30 plus
the behavior-coverage/refactoring portion of the season-readiness plan. Stop here
for user review before Phase 3. The user is preparing the Phase 4 visual guide
separately.

## What changed

- One season-resource loader now owns loading, errors, empty-state resets and
  response generations for the three season/profile composables. Earlier season
  or player responses cannot overwrite a newer selection; unmounted views ignore
  completions. Season labels remain reactive.
- Shared draft countdown and version validation, including rejection of older
  poll/socket responses; disconnected drafts poll every
  30 seconds and refresh on reconnect. Intentional socket shutdown cancels pending
  reconnects and clears handlers; a connecting socket is reused.
- HTTP Lambda entrypoint delegates to HTTP, season, repository, schedule, draft
  rules and draft service modules. Checker delegates to NHL, state storage,
  scheduler and transactional finalization modules. Dependencies are injectable
  so tests exercise the actual handlers without bootstrapping AWS clients.
- HTTP contract tests preserve routes, status/payload, CORS/cache, season-table
  selection, configured admin rejection, locks and optimistic-version behavior.
- Cypress retains the original 17 scenarios and adds 12 for draft safeguards,
  polling/recovery, auto-pick, pregame, Home recovery and season navigation.
- Persistence tests run against DynamoDB Local in CI and were also exercised
  against fresh disposable AWS tables with synthetic data. The real closeout
  shell script is tested through a restricted CLI shim; Lambda config writes are
  captured locally. Production configuration/data is never modified.
- A packaging command verifies and archives every Lambda runtime module. A
  single-file Lambda upload is no longer sufficient.

## Separately reproduced defects and fixes

1. **Lost defense on retry:** the original checker saved a game before updating
   counters. A failure before the player update left a record that made every
   retry skip that credit. The injected-failure integration test failed on the
   original implementation (4 defenses instead of 5) and passes with one atomic
   game/champion/player transaction. Duplicate/concurrent events still award once.
   Discovery also no longer reopens a finalized game before checking its ledger.
2. **Stale season/profile results:** the new lifecycle tests failed 5 of 6 cases
   against the old loaders. Per-resource response generations, immediate clearing
   on selection changes and disposal guards fix these cases.
3. **Abandoned socket reconnect:** deliberate close could schedule a new socket
   after page departure. Cleanup now cancels the timer and detaches callbacks.
4. **Home outage recovery:** status could recover without fetching the game,
   leaving the page in its no-game state. Successful recovery now loads details.
5. **Stale Home owners:** owner objects were snapshots of the earlier roster.
   Reactive roster resolution now clears/remaps owners, including final results.

## Verification

- Frontend unit tests: 79 pass across 14 files.
- API/scheduler/checker contracts: 16 pass. The 10 API contracts also passed
  against the original unextracted handler using an injected test factory.
- Disposable AWS DynamoDB tests: 8 pass, including concurrent picks, rollback,
  undo, duplicate finalization, retry, eligibility, live state, legacy records,
  and concurrent/rerun closeout. Tables deleted after the run.
- Cypress: 29/29 pass across five suites; no pending/skipped tests.
- Lint (including explicit CommonJS checks), production build and Lambda package
  verification pass. Packages contain 11 HTTP and 9 checker runtime files.
- GitHub CI: [live PR checks](https://github.com/ryandeshon/in-season-stanley-cup/pull/75/checks)
  run browser, unit/backend/persistence, changeset and security workflows.
  Persistence and packaging are part of the already-required `unit-tests` job;
  the existing branch protection remains unchanged.
- Local runtime: Node 25; CI runtime: Node 22. No Lambda runtime deployment test
  has been performed.

The season-navigation browser suite opens navigation and uses the season selector's
keyboard controls, including at a mobile viewport. Pointer-driven nested select
menus triggered Chromium ResizeObserver diagnostics in the development server;
keyboard navigation exercises the same selection handler without exception
suppression. All window exceptions and unstubbed backend requests still fail.

## Phase 3 boundaries and remaining risks

This is a stronger behavior baseline, not a completed multi-season migration:

- Legacy API reads select season tables, but GameOptions champion/draft state is
  still shared. Archived draft writes and season-over write locks are not enforced.
  Stronger admin authentication remains #29/#36. The contract tests assert rejection
  only when the existing admin token is configured; they do not prove player auth.
- Browser season-switch tests verify response selection/ownership and navigation
  with distinct fixture rosters. They do not prove the production API has an
  isolated historical champion. Empty-season rendering uses an existing season
  fixture; the Season 3 catalog/initialization is Phase 3.
- Rapid season/profile response ordering is tested at the real composable level;
  browser tests cover user-visible switching. Real multi-client WebSocket delivery
  is not simulated by Cypress; unit tests cover reconnect lifecycle and the browser
  covers the polling fallback.
- Pagination, draft normalization/initialization races, global draft reset atomicity,
  and quiescing all writers must be handled with the Phase 3 data contract. These
  are not covered by the initialized-draft transaction guarantees in this PR.
- Finalization leaves existing legacy game records untouched. It cannot infer
  whether old partial failures already lost credits. Reconcile historical counts
  before carrying lifetime `totalDefenses` and `championships` into Season 3.
- Runtime AWS SDK v2 availability, table permissions for transaction actions, and
  complete ZIP deployment must be verified at cutover. See the
  [testing and packaging runbook](../../../docs/phase2-testing-and-lambdas.md).
- The repository security scanner flags three pre-existing lines in unrelated
  files (an earlier backlog example and asset infrastructure policy templates).
  Those files are unchanged from main; staged changes contain no new secrets or
  infrastructure identifiers.
- Existing bundle-size/Browserslist warnings remain. Asset/build-tool changes are
  deferred to their own scope.

Next, after review: read-only historical inventory/reconciliation; backup/restore
rehearsal; isolated Season 3 draft/rosters/game state; and explicit lifetime-stat
carryover. No redesign, database migration, production repair, or Lambda deployment
has been performed in Phase 2.
