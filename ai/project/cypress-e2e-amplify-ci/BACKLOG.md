# BACKLOG: cypress-e2e-amplify-ci

## Status legend
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks
| ID | Status | Task | Owner | Verification |
|---|---|---|---|---|
| 1 | DONE | Define scope and acceptance criteria in project spec | AI + Human | `ai/project/cypress-e2e-amplify-ci/SPEC.md` committed |
| 2 | DONE | Implement Cypress fixture/stub strategy for multiple game-day states | AI | `cypress/fixtures/*`, `cypress/support/commands.js` updated |
| 3 | DONE | Add/expand E2E coverage for homepage, selector spectator mode, and game details | AI | `cypress/e2e/homepage.cy.js` updated |
| 4 | DONE | Add/adjust app behavior required for deterministic selector flow | AI | `src/pages/HomePage.vue` updated |
| 5 | DONE | Ensure Amplify test-branch CI runs E2E and blocks failures | AI | `amplify.yml` branch-gated test step + npm fallback |
| 6 | DONE | Update developer docs for local workflow, fixtures, and Amplify CI sync | AI + Human | `docs/testing.md`, `README.md` updated |
| 7 | BLOCKED | Execute local Cypress run and capture evidence in this environment | AI | Blocked: `npm`/`yarn` binaries unavailable in current shell |
| 8 | TODO | Human validation in full Node environment + Amplify branch build verification | AI + Human | Successful local run + Amplify logs on `test` branch |

## Notes
- Existing baseline Cypress setup in this branch was extended rather than replaced.
- Pending verification requires a shell with Node package manager binaries available.
