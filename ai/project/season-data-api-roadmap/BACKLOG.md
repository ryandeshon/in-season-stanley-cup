# BACKLOG: season-data-api-roadmap

## Status legend
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks
| ID | Status | Task | Owner | Verification |
|---|---|---|---|---|
| 1 | DONE | Define scope and acceptance criteria for issues `#23`, `#35`, `#33`, `#38`, `#39`, `#40` | AI + Human | `SPEC.md` created |
| 2 | DONE | Implement backend API changes (season parsing, draft version conflicts, champion history) | AI | `lambdas/http-api/index.js` + `tests/unit/httpApi.spec.js` |
| 3 | DONE | Implement frontend integration (season meta, timeline, draft conflict handling) | AI | `src/pages/*.vue`, `src/composables/*`, `src/services/*` |
| 4 | DONE | Expand automated tests (API contracts + Cypress homepage/draft coverage) | AI | `tests/unit/*.spec.js`, `cypress/e2e/*.cy.js`, fixtures |
| 5 | DONE | Document season-data handling and rollout guidance | AI | `docs/season-data-runbook.md`, `README.md`, `docs/testing.md` |
| 6 | DONE | Final verification run | AI | `npm run test:unit`, `npm run lint`, `npm run test:e2e` |

## Notes
- Issues:
  - `https://github.com/ryandeshon/in-season-stanley-cup/issues/23`
  - `https://github.com/ryandeshon/in-season-stanley-cup/issues/35`
  - `https://github.com/ryandeshon/in-season-stanley-cup/issues/33`
  - `https://github.com/ryandeshon/in-season-stanley-cup/issues/38`
  - `https://github.com/ryandeshon/in-season-stanley-cup/issues/39`
  - `https://github.com/ryandeshon/in-season-stanley-cup/issues/40`
- Verification date: 2026-03-15
