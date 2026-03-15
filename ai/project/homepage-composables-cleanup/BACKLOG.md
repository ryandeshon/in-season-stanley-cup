# BACKLOG: homepage-composables-cleanup

## Status legend
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks
| ID | Status | Task | Owner | Verification |
|---|---|---|---|---|
| 1 | DONE | Define scope and acceptance criteria from GitHub issue `#17` | AI + Human | `ai/project/homepage-composables-cleanup/SPEC.md` created |
| 2 | DONE | Extract Home page game/champion state orchestration into `useCupGameState` | AI | `src/composables/useCupGameState.js` + `HomePage.vue` integration |
| 3 | DONE | Extract realtime feed orchestration into `useLiveGameFeed` and matchup scheduling into `useUpcomingMatchups` | AI | `src/composables/useLiveGameFeed.js`, `src/composables/useUpcomingMatchups.js` |
| 4 | DONE | Document composable responsibilities and expected I/O | AI + Human | `docs/homepage-composables.md` |
| 5 | DONE | Run lint/tests and finalize verification evidence | AI + Human | `npm run lint` + homepage Cypress spec passing |

## Notes
- This tracks issue: `https://github.com/ryandeshon/in-season-stanley-cup/issues/17`.
- Keep all existing homepage selectors and route behavior stable.
- Verification run on 2026-03-15:
  - `npm run lint`
  - `ELECTRON_RUN_AS_NODE= npx start-server-and-test "npm run cy:serve" http://localhost:8080 "npx cypress run --spec cypress/e2e/homepage.cy.js"`
