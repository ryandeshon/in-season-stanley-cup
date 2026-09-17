# Phase 1 review — restore the browser regression gate

Date: September 17, 2026. Draft PR: [#73](https://github.com/ryandeshon/in-season-stanley-cup/pull/73). Related issue: [#71](https://github.com/ryandeshon/in-season-stanley-cup/issues/71).

## Delivered

- Restored all 17 existing browser scenarios across four suites.
- Enforced test-only API/NHL/socket/asset configuration despite inherited CI variables.
- Matched request paths independently from season/cache query strings.
- Blocked unstubbed requests and stubbed external fonts, logos and analytics.
- Fixed fixture clocks, stale live-only scorer assertions and draft mock responses.
- Added browser checks on PRs/main, retained AWS test-branch support and added an explicit validation-branch opt-in.
- Added result artifacts and rejection of zero/skipped/incomplete suites.
- Aligned Amplify with CI's Node 22 and included the three checker tests in CI.
- Configured main branch protection to require browser and unit checks, with up-to-date branches; administrator bypass remains available.
- Added a patch changeset for 2.4.1 and assigned #71 that release label.

## Verification

| Check | Result |
| --- | --- |
| Clean-main baseline | 65 unit tests, 3 checker tests, lint and production build pass |
| Final local browser suite with deliberately conflicting inherited API/socket settings | 17 passed, zero failed/pending/skipped |
| Intentional failing browser test | Exit code 1; temporary test removed |
| Empty/pending/skipped/incomplete-suite gate probes | All rejected |
| Final local unit/checker/lint/build | Pass |
| GitHub Linux browser runs | Three consecutive passes on the implementation commit; [attempt history](https://github.com/ryandeshon/in-season-stanley-cup/actions/runs/35257470982) |
| GitHub unit/checker, changeset and security checks | Pass |
| Isolated AWS Amplify validation | 17/17 browser tests pass; production build succeeds |
| Changeset | Exactly one patch: 2.4.0 → 2.4.1 |

Hosted validation used implementation commit `fc205d7`. The local security script
reports pre-existing generic-pattern matches in unchanged documentation and ARN
templates; the hosted security checks pass. No new credentials or private resource
identifiers were added.

## Review boundary

No application game rules, Lambda write paths, database records, lifetime totals,
or historical season data were changed. The old WIP remains untouched. Main has
not been merged or deployed by this work. The temporary AWS validation branch was removed after successful BUILD/DEPLOY/VERIFY checks.

This suite protects the existing UI scenarios using mocks. Actual write semantics,
partial-failure recovery, cross-season isolation and migration parity still need
the Phase 2/3 contract and integration coverage. Passing browser tests alone does
not certify those paths.

Stop here for user review. After approval, Phase 2 adds behavior coverage and
targeted refactors. The user will provide the Phase 4 redesign guide separately.
