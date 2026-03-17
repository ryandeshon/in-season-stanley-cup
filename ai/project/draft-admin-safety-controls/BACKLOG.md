# BACKLOG: draft-admin-safety-controls

## Status legend
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks
| ID | Status | Task | Owner | Verification |
|---|---|---|---|---|
| 1 | DONE | Define scope and confirm acceptance criteria for issue `#26` | AI + Human | `SPEC.md` created |
| 2 | DONE | Implement backend draft safety endpoints and state fields | AI | `lambdas/http-api/index.js` + `tests/unit/httpApi.spec.js` |
| 3 | DONE | Implement admin/player UI controls and countdown visibility | AI | `src/pages/DraftAdminPage.vue`, `src/pages/DraftPage.vue`, `src/services/dynamodbService.js` |
| 4 | DONE | Expand Cypress coverage for lock/undo/countdown controls | AI | `cypress/e2e/draft.cy.js`, fixtures, commands |
| 5 | DONE | Security scrub, verification, and PR prep | AI + Human | `npm run lint`, `npm run test:unit`, draft E2E spec pass |

## Notes
- Keep tasks small and independently verifiable.
- Update this file as work progresses.
- Link PRs, commits, and test evidence here.
- For merged PRs that complete tasks/issues, include closing keywords in PR body (e.g., `Closes #123`).
- Issue link: `https://github.com/ryandeshon/in-season-stanley-cup/issues/26`
- Verification evidence:
  - `npm run lint`
  - `npm run test:unit`
  - `ELECTRON_RUN_AS_NODE= npx start-server-and-test "npm run cy:serve" http://localhost:8080 "cypress run --spec cypress/e2e/draft.cy.js"`
