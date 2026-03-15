# BACKLOG: composable-unit-tests

## Status legend
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks
| ID | Status | Task | Owner | Verification |
|---|---|---|---|---|
| 1 | DONE | Define scope and acceptance criteria from issue `#37` | AI + Human | `ai/project/composable-unit-tests/SPEC.md` created |
| 2 | DONE | Add unit-test harness and scripts (Vitest + jsdom + alias config) | AI | `vitest.config.mjs`, `package.json` scripts |
| 3 | DONE | Add composable unit tests for state transitions, socket fallback, and matchup filtering | AI | `tests/unit/*.spec.js` |
| 4 | DONE | Add CI workflow for unit test execution | AI | `.github/workflows/unit-tests.yml` |
| 5 | DONE | Run lint/tests and capture final verification evidence | AI + Human | `npm run test:unit` (4 files / 21 tests) + `npm run lint` |

## Notes
- Issue: `https://github.com/ryandeshon/in-season-stanley-cup/issues/37`
- Tests should be deterministic and avoid external network calls.
- Verification run on 2026-03-15:
  - `npm run test:unit`
  - `npm run lint`
