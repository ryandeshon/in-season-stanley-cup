# Season readiness: refactoring, reliable tests, historical data, redesign

Status: approved September 17, 2026; Phase 1 complete; awaiting user review. Stop for user review after each phase. Phase 4 design guide will be prepared by the user in another chat.

## Objective and sequence

Prepare the app for Season 3 and a complete visual redesign without changing game rules or losing prior-season records. Sequence: audit and small covered refactors; restore reliable browser coverage (#71); strengthen game/data tests; complete season isolation and rehearse rollover (#28); redesign against protected behavior; verify release.

The broader plan and Phase 1 are authorized. Phase 1 changes test infrastructure and fixtures only; no game rules or production data changes. Continue into Phase 2 only after the Phase 1 review.

## Baseline and workspace

- Reviewed current main at `7f017d0` and the local `isc-038-offseason-season-data-refactor` WIP separately.
- Preserved the original working tree. This plan lives in a separate worktree on `isc-071-season-readiness-plan`, based on main.
- Old PR #51 was closed unmerged; reuse its useful ideas selectively, not its entire stale branch.
- Original WIP contains unresolved conflict markers in `lambdas/http-api/index.js`, `src/pages/DraftPage.vue`, and `cypress/support/commands.js`. Git does not currently list these as unmerged index entries.
- The earlier WIP unit run passed 65 tests in 11 files. It did not validate these conflicted files or establish a build/browser baseline. API contract tests are absent from main as well as the current working tree; recover and adapt them, rather than assuming they are covered.
- Main contains four skipped Cypress suites / 17 tests. Amplify runs Cypress only on its `test` branch. The GitHub unit workflow does not run the check-game `node:test` suite.
- No production database inventory, AWS environment inspection, migration, or deployment has been performed for this audit.

## Refactoring findings, in priority order

| Area | Evidence | Proposed change and validation |
| --- | --- | --- |
| Test fixtures/configuration | Cypress helpers couple routes to `/api`; environment overrides can bypass them; four suites are skipped | As part of #71, centralize route matching and scenario setup, explicitly configure the test server, and reject unexpected backend traffic. Validate original 17 cases locally and in CI. |
| Season data loading | `useSeasonData`, `useCurrentSeasonData`, and `usePlayerSeasonData` repeat fetching/loading/error logic; no request-generation guard | Consolidate shared season loading with reactive outputs and protection against stale responses. First test rapid season/profile changes and out-of-order success/failure. Preserve existing empty/error behavior. |
| Draft presentation and rules | `DraftAdminPage.vue` is 814 lines; both draft pages calculate countdowns and manage timers/versioned mutations | Extract shared countdown and draft-action state into tested utilities/composables, leaving rendering in pages. Test lock, undo, stale versions, timers and unmount cleanup before moving code. Keep server authoritative. |
| Lambda boundaries (#30) | Main HTTP handler is 1,330 lines; checker is 777; route parsing, domain rules, persistence and infrastructure are coupled | Restore contract tests, then extract one boundary at a time: HTTP/CORS, draft rules, repositories, scheduling, finalization. Preserve response schemas and cache headers. Verify deployment packages include new modules. |
| Game finalization integrity | Checker writes game record before incrementing defenses; retry skips the increment if the record already exists | Treat as a potential correctness defect, separate from mechanical refactoring. Reproduce a failure between writes, then use atomic or resumable season-scoped finalization. Assert exactly-once totals under retries and concurrent invocation. |
| Presentation boundaries | Home/profile pages combine data mapping with substantial markup; existing composables already provide a useful start | Extract stable view models and reusable visual sections after behavior coverage. Avoid premature component churn before the new design is defined. |
| Lower-priority tooling/assets | Eager asset fallbacks (#31), Vue CLI configuration and mixed CI Node versions | Align test runtime for #71. Defer broader build-tool migration and asset optimization unless measured problems block readiness. |

Do not bundle a schema migration, game-rule fixes, framework migration and visual changes into one refactor. Small behavior-preserving changes may proceed under existing authorization; risky moves first need focused characterization tests.

## Browser testing recommendation

Keep Cypress for #71 and Vitest for frontend/domain unit tests. The app already has useful fixtures, test hooks, and 17 browser scenarios. The observed failure mode does not require a new browser runner.

Use stable `data-test` hooks or accessible role/name queries for actions and outcomes. Avoid styling classes, Vuetify internals and exact layout as functional assertions. Control time and external responses; wait on requests/state, not sleeps. This lets a redesign change markup and appearance while retaining behavioral contracts.

Playwright is a reasonable later option for native screenshot comparisons, cross-browser coverage and multi-client/WebSocket scenarios. Do not introduce two overlapping functional suites now. Reconsider it only against a concrete capability gap after #71 is green; if adopted, port representative flows and prove parity before replacing Cypress.

References: [Cypress best practices](https://docs.cypress.io/app/core-concepts/best-practices), [route matching](https://docs.cypress.io/api/commands/intercept), [Vue CLI environment precedence](https://cli.vuejs.org/guide/mode-and-env.html), [Playwright screenshots](https://playwright.dev/docs/test-snapshots), [Playwright network/WebSocket testing](https://playwright.dev/docs/network).

## Phase 1 — #71: recover a trustworthy browser gate

1. Establish main's unit, checker, lint-without-fixing and production-build baseline in the clean worktree. Record existing failures separately.
2. Reproduce the intercept issue with CI-style environment overrides. Existing process variables take precedence over `.env.cypress`; the file's comments do not enforce isolation. Actual Amplify variables/logs remain to be checked.
3. Launch the browser-test server with explicit test API/NHL URLs and disabled or controlled sockets. Keep these overrides scoped to tests; production build must retain production settings. Stub before app boot, including season bootstrap where relevant.
4. Replace ambiguous URL globs with method/path/query-aware matchers. Distinguish `/champion` from `/champion/history`, and collection versus player detail routes. Support intentional API stage prefixes. Fail on unmatched application/NHL requests so a missed stub cannot contact production.
5. Re-enable all four suites. Use deterministic fixtures, isolated local storage, controlled clocks for countdowns, and observable state assertions.
6. Run on PRs and main in GitHub Actions; retain/verify Amplify's test-branch run to meet #71's AWS criterion. Align supported Node/browser versions and collect failure screenshots, logs and test reports.
7. Detect zero executed tests and unexpected skipped suites. Verify a deliberately failing test blocks CI, then remove that temporary failure. Require the resulting check before merge.

Exit: all 17 existing tests execute and pass locally and in AWS, with three consecutive clean CI runs as an initial stability check, documented root cause, failure artifacts, and no unintended production traffic. Three passes are a starting check, not proof of zero flakiness. Do not close #71 on local success alone.

## Phase 2 — behavior coverage and refactors

| Layer | Required cases |
| --- | --- |
| Browser: Home/game | Pregame, live scoring, final winner, off-day outlook, season over, missing data, failed API, navigation and recovery |
| Browser: draft | Start, correct player/turn, unavailable team, lock/unlock, undo, reset, auto-pick deadline, version conflict, reconnect/poll fallback and completed read-only draft |
| Browser: history | Season switching across Home/Standings/Profile/Game, historical team ownership, head-to-head records, empty new season, rapid changes and mobile navigation |
| Backend contracts | Status/payload/cache/CORS behavior, season parsing, admin rejection, optimistic concurrency, draft isolation and season write locks |
| Checker/persistence | Regular-season eligibility, champion changes, defenses, duplicate events, partial failures, simultaneous retries and closeout award exactly once |

Mocked browser tests protect UI behavior; they do not prove database writes. Use unit/contract tests plus isolated integration tables to exercise real persistence semantics. Add checker tests to CI. Characterize existing rules before refactoring and track discovered defects separately.

## Phase 3 — preserve last season and prepare Season 3 (#28)

Data contract:

- Preserve Season 1/2 game records, roster ownership, season standings/defenses, draft history and champion results as historical data.
- Carry `championships` and `totalDefenses` forward as lifetime totals, using audited authoritative values. Do not sum snapshots that may already contain cumulative totals.
- Initialize Season 3 `titleDefenses` at zero and its roster/draft independently. Reset only new-season fields, never last year's records.
- Explicitly configure Season 3 catalog/default, dates, starting champion, checker season, and asset fallback. Archived reads must not depend on current roster ownership or current champion state.
- Make preseason/active/completed behavior consistent between API and routing; the old WIP route guard needs correction for a fresh preseason draft.

Execution:

1. Inventory actual tables, keys, player IDs, record counts, pagination and season metadata using read-only access. Confirm whether Season 2 closeout award already ran.
2. Produce a per-player/per-season reconciliation report. Verify snapshots/backups and a restore path before any reset or migration.
3. Adapt the old multi-season approach on main: lifetime players, season players, season-keyed games/drafts and explicit catalog. Update closeout scripts and checker together with the data contract.
4. Give the migration a true default dry-run; the old script writes despite the runbook calling its default dry-safe. Require explicit apply, schema preflight, stable ID mapping, rerun safety, and before/after reconciliation.
5. Rehearse on disposable copies: compare every historical record and lifetime total, initialize Season 3, run draft + game + closeout, rerun events/migration, and prove Season 2 is unchanged. Restore backups in the rehearsal.
6. Schedule production cutover separately after rehearsal: quiesce writers, take final snapshot, migrate, validate parity, deploy compatible readers/writers, verify and resume. Retain old data and a documented rollback window. Account for any new writes before reverting.

Exit: exact historical parity, unchanged lifetime totals at rollover, zero new-season defenses, isolated draft/rosters, idempotent game and closeout writes, and a demonstrated restore. No production migration is part of this planning task.

## Phase 4 — complete visual redesign

After the functional gate is reliable, agree on visual direction and page/state inventory. Implement design tokens and shared layouts, then redesign one page at a time while retaining behavioral hooks. Cover loading/error/empty/live/final/archived states, desktop/mobile, keyboard use and contrast.

Review screenshots for the new design as each page is accepted. Establish visual regression baselines against the approved new design; old screenshots are reference material, not constraints that prevent redesign. Functional assertions remain required throughout.

## Release gate and scope control

- Browser tests, unit/contract/checker tests, build and non-mutating lint pass; no accidental test skips or conflict markers.
- Database rehearsal/parity report accepted and season setup verified.
- Draft auth work (#29/#36) assessed before exposing new-season administrative actions; consolidate overlapping scope. Player login (#53) is a separate feature, not a prerequisite for restoring tests.
- Use small issue-linked PRs, patch changesets for behavior-preserving refactors, and review release impact for schema/features rather than assigning all work one release number. #71 still needs its release label before PR creation.
- No automatic production data changes, merges, deployments or visual baseline acceptance in this planning phase.

## Review decision

Approved sequence: Cypress recovery first, focused covered refactors, historical-data protection and rollover rehearsal, then visual redesign. Phase 1 is complete; see PHASE-1-REVIEW.md. Await the requested review before Phase 2.
