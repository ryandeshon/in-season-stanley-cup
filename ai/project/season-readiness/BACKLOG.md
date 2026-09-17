# Season readiness backlog

| ID | Status | Work | Verification |
| --- | --- | --- | --- |
| 1 | DONE | Audit current main and old WIP; identify refactoring/test/data risks | Findings in SPEC.md; main 7f017d0 |
| 2 | DONE | Preserve WIP and create isolated planning worktree | isc-071-season-readiness-plan |
| 3 | DONE | Draft staged plan and runner recommendation | SPEC.md |
| 4 | TODO | User review of broader sequence and scope | Review in conversation; refactoring already authorized |
| 5 | TODO | Establish clean-main baseline and characterize refactor targets | Unit/checker/lint/build results and focused behavior tests |
| 6 | TODO | Fix #71 environment and intercept behavior; activate 17 tests | Local and AWS runs; no unintended backend requests |
| 7 | TODO | Add PR browser gate, skip detection and failure artifacts | Three clean CI runs; deliberate failure blocks gate |
| 8 | TODO | Add API/checker persistence and failure-path coverage | Contract tests and isolated integration tests |
| 9 | TODO | Extract season loading, draft logic and Lambda modules in small changes | Behavior parity and relevant tests per PR |
| 10 | TODO | Inventory historical data and verify closeout/lifetime baseline | Read-only reconciliation report |
| 11 | TODO | Implement season isolation and safe migration/rollover tools | Dry-run + rerun + restore rehearsal on copies |
| 12 | TODO | Verify Season 3 draft/game lifecycle preserves Season 2 | Historical parity and exactly-once statistics |
| 13 | TODO | Design review, page-by-page redesign and visual baselines | Functional gate plus approved responsive/accessibility review |
| 14 | TODO | Production readiness and separately scheduled cutover | Release checklist, reconciliation and rollback evidence |

Related: #71 (browser testing), #28 (multi-season), #30 (Lambda modules), #29/#36 (admin auth), #31 (assets), #53 (player login), closed PR #51 (prior migration work).

No application refactors or #71 fixes have been implemented in this planning change. Existing WIP is untouched.
