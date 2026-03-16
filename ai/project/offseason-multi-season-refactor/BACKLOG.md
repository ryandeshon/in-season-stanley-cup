# BACKLOG: offseason-multi-season-refactor

## Status legend
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks
| ID | Status | Task | Owner | Verification |
|---|---|---|---|---|
| 1 | DONE | Create branch from `main` and include in-season draft write lock commit | AI | `git log` includes cherry-pick `1b006e9` |
| 2 | DONE | Cut over HTTP API to multi-season tables + add `/season/options` | AI | `lambdas/http-api/index.js` |
| 3 | DONE | Update frontend season option bootstrap and draft route gating | AI | `src/main.js`, `src/store/seasonStore.js`, `src/router/index.js` |
| 4 | DONE | Cut over checker Lambda writes to season/lifetime split tables | AI | `lambdas/check-game/index.js` |
| 5 | DONE | Add offseason one-time migration script | AI | `scripts/aws/offseason-migrate-season-data.sh` |
| 6 | DONE | Update runbook + README for migration/cutover model | AI | `docs/season-data-runbook.md`, `README.md` |
| 7 | DONE | Update unit tests for new API table model and run verification | AI | `tests/unit/httpApi.spec.js`, `npm run test:unit`, `npm run lint` |
| 8 | DONE | Open Draft MR with `[OFFSEASON]` prefix + `offseason` label + merge gate checklist | AI | https://github.com/ryandeshon/in-season-stanley-cup/pull/51 |

## Notes
- Merge gate:
  - `GET /season/meta?season=season2` returns `seasonOver=true`
  - Date on/after April 17, 2026
  - Pre-draft window confirmed by operator
