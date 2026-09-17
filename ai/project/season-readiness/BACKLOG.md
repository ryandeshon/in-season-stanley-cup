# Season readiness backlog

| ID | Status | Work | Verification |
| --- | --- | --- | --- |
| 1 | DONE | Audit current main and old WIP; identify refactoring/test/data risks | Findings in SPEC.md; main 7f017d0 |
| 2 | DONE | Preserve WIP and create isolated planning worktree | isc-071-season-readiness-plan |
| 3 | DONE | Draft staged plan and runner recommendation | SPEC.md |
| 4 | DONE | User review of broader sequence and scope | Approved; stop after each phase; user supplies Phase 4 design guide |
| 5 | DONE | Establish clean-main baseline | 65 unit + 3 checker tests; lint/build pass; characterization of future refactors stays in Phase 2 |
| 6 | DONE | Fix #71 environment and intercept behavior; activate 17 tests | Local and AWS runs; no unintended backend requests |
| 7 | DONE | Add PR browser gate, skip detection and failure artifacts | Three clean CI runs; local deliberate failure returns exit 1; required main checks verified |
| 8 | DONE | Add API/checker persistence and failure-path coverage | Contract tests and isolated integration tests |
| 9 | DONE | Extract season loading, draft logic and Lambda modules in small changes | Behavior parity and relevant tests per PR |
| 10 | TODO | Inventory historical data and verify closeout/lifetime baseline | Read-only reconciliation report |
| 11 | TODO | Implement season isolation and safe migration/rollover tools | Dry-run + rerun + restore rehearsal on copies |
| 12 | TODO | Verify Season 3 draft/game lifecycle preserves Season 2 | Historical parity and exactly-once statistics |
| 13 | TODO | Design review, page-by-page redesign and visual baselines | Functional gate plus approved responsive/accessibility review |
| 14 | TODO | Production readiness and separately scheduled cutover | Release checklist, reconciliation and rollback evidence |

Related: #71 (browser testing), #28 (multi-season), #30 (Lambda modules), #29/#36 (admin auth), #31 (assets), #53 (player login), closed PR #51 (prior migration work).

Phase 1 was merged in #73. Phase 2 is implemented on
`isc-030-phase2-behavior-refactors`; local verification is complete and draft PR #75 is open for the
phase review. See PHASE-2-REVIEW.md and the PR checks for CI results. Production-data inventory, rollover, and visual redesign remain in
Phases 3 and 4. The original WIP is untouched.

## Phase 3 — #28 season isolation and rollover

- DONE: read-only inventory, stable string player IDs, corroborated Season 2 roster recovery and explicit counter discrepancies.
- DONE: opt-in canonical season/lifetime storage, catalog-based frontend, archived write guards, season-tagged checker, atomic reset and closeout.
- DONE: dry-run migration, source/target fingerprints, schema/identity preflight, conditional reruns and separate restore copy.
- DONE: disposable AWS rehearsal with actual exported Season 1/2 data; historical rows and restored backup remained unchanged after draft/game/closeout.
- DONE: local regression checks, packaging and sanitized review; draft PR/CI review checkpoint pending.
- REVIEW: approve/reconcile Terry's preserved 11 seasonal / 28 lifetime baseline before production cutover.
- DEFERRED TO CUTOVER: production managed-backup restore, IAM/writer/schedule quiescence, authorization #29/#36, starting champion and dates, deployment and cache invalidation.
- STOP: Phase 4 starts only after this phase is reviewed and the separate redesign guide is supplied.
