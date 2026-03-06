# BACKLOG: game-day-matchups

## Status legend
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks
| ID | Status | Task | Owner | Verification |
|---|---|---|---|---|
| 1 | DONE | Define scope, UX flow, and acceptance criteria in project spec | AI + Human | `ai/project/game-day-matchups/SPEC.md` committed |
| 2 | DONE | Implement game-day Champion/Challenger selection and conditional matchup panel on homepage | AI | `src/pages/HomePage.vue` updated |
| 3 | DONE | Add/adjust Cypress fixtures and tests for champion/challenger switching and empty-state flow | AI | `cypress/fixtures/cup-day-multiple-games.json`, `cypress/e2e/homepage.cy.js` updated |
| 4 | BLOCKED | Regression-check off-day and stable error rendering behavior | AI | Blocked: no `npm`/`yarn` available in this shell to execute Cypress |
| 5 | TODO | Final verification and ticket close-out | AI + Human | Acceptance criteria confirmed against SPEC after Cypress run |

## Notes
- "Syd player" is interpreted as selected player (Champion or Challenger).
- No default side is selected when game-day matchup first renders.
- No backend API contract changes are required.
