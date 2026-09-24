# Season 3 launch

Version 3.0.0 promotes the approved Black Rink theme to production and opens
Season 3 in preseason. Previous seasons remain selectable and read-only.
Season 3 begins with four empty rosters, zero seasonal defenses, preserved
lifetime totals, and all 32 teams available. The game checker stays stopped
until the draft is complete and a starting champion and season dates are set.

Draft participants enter a private player-specific access code on their draft
page. The server binds that code to the requested player. Admin controls and
autopicks require the admin token; no secrets are embedded in the app bundle or
stored in browser storage. Configure `DRAFT_PLAYER_TOKENS` as a JSON object keyed
by player ID and `ADMIN_API_TOKEN` in the HTTP Lambda. API Gateway CORS must allow
`x-draft-token` and `x-admin-token`. Codes are distributed privately by the owner.
Draft views refresh every five seconds, including while WebSocket is connected.

The HTTP API requires `/seasons`, `/draft/pick`, `/draft/undo-last-pick`, and
`/check-status` routes in addition to the existing routes. During preseason,
season reads use no-store responses and CDN caching is disabled. All five
canonical DynamoDB tables have point-in-time recovery enabled. Legacy writers
and game schedules are disabled; legacy tables are retained as a rollback source.

The rollout preserves 87 Season 1 games and 69 Season 2 games. Season 2's existing
championship award is carried forward without awarding it again. The migration
records Terry's existing discrepancies (11 seasonal defenses versus 10 recorded
wins; 28 lifetime defenses versus 34 in season snapshots) and preserves stored
values. Original draft history was already unavailable; it is not reconstructed.

Validation includes frontend and backend tests, a full browser regression,
a complete 32-pick AWS rehearsal against disposable copies, atomic/concurrent
writes, undo, reset, activation and closeout, unchanged archive fingerprints,
and a managed DynamoDB backup restore matching all Season 2 game records.
Private source exports, backup identifiers, rollback Lambda packages, merged
environments and draft codes remain outside git.

Use `docs/season-rollover-v2.md` for activation and rollback. After live draft
writes, preserve canonical data when rolling back; never switch to the legacy
tables and discard picks. Automatic game scoring remains deliberately inactive
through preseason. Keep the admin draft page open when using its autopick timer.

Browser checks can use another free port without disturbing other local apps:

```sh
TEST_APP_PORT=8185 CYPRESS_BASE_URL=http://localhost:8185 ELECTRON_RUN_AS_NODE= \
  npx start-server-and-test 'yarn cy:serve' http://localhost:8185 'cypress run'
```
