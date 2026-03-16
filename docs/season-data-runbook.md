# Season Data Runbook

## Offseason merge gate (required)
Merge the offseason refactor only when all checks pass:

1. `GET /season/meta?season=season2` returns `seasonOver=true`
2. Date is on/after **April 17, 2026**
3. Operator confirms pre-draft offseason window

## Target data model (single multi-season structure)

- `PlayerLifetime`
  - Partition key: `playerId`
  - Fields: `name`, `championships`, `totalDefenses`, timestamps
  - Carry-over fields: `championships`, `totalDefenses`
- `PlayerSeason`
  - Partition key: `seasonId`
  - Sort key: `playerId`
  - Fields: `name`, `teams`, `titleDefenses`, timestamps
  - Season-only field: `titleDefenses` (reset to `0` each new season)
- `GameRecordsV2`
  - Partition key: `seasonId`
  - Sort key: `gameId`
  - Fields: historical winner/loser data per game
- `DraftState`
  - Partition key: `draftId`
  - Rule: `draftId = seasonId`
- `GameOptions`
  - Keeps champion/checker state
  - Holds `seasonCatalog` item for `GET /season/options`

## Season-aware API behavior

- `?season=seasonN` (or `?season=N`) is accepted.
- Omitted `season` uses `DEFAULT_SEASON` (fallback: `season2`).
- Backend uses only the new tables (`PlayerSeason`, `PlayerLifetime`, `GameRecordsV2`, `DraftState`).

### Endpoints
- `GET /season/options`
- `GET /season/meta`
- `GET /players`
- `GET /players/:name`
- `POST /players/reset-teams`
- `PATCH /players/:id/teams`
- `GET /game-records`
- `GET /champion/history`
- `GET /champion`
- `GET /gameid`
- `GET /check-status`
- `GET /draft/state`
- `PATCH /draft/state`
- `POST /draft/select-team`

## Draft/team write lock policy

Mutating draft/team routes are blocked during active season (`409`), unless:

- season is over (`seasonOver=true`), or
- pre-season with no game records, or
- emergency override is set: `ALLOW_IN_SEASON_DRAFT_WRITES=true`

Protected routes:
- `POST /players/reset-teams`
- `PATCH /players/:id/teams`
- `PATCH /draft/state`
- `POST /draft/select-team`

## Contract deployment verification checklist

Use this checklist any time frontend relies on API contracts:

1. Route existence checks:
- `GET /season/meta`
- `GET /champion/history`
- `GET /season/options`

2. CORS checks from local origin:
```bash
curl -i -H 'Origin: http://localhost:8080' \
  'https://<api-id>.execute-api.us-east-1.amazonaws.com/<stage>/season/meta?season=season2'

curl -i -H 'Origin: http://localhost:8080' \
  'https://<api-id>.execute-api.us-east-1.amazonaws.com/<stage>/champion/history?season=season2&limit=6'

curl -i -H 'Origin: http://localhost:8080' \
  'https://<api-id>.execute-api.us-east-1.amazonaws.com/<stage>/season/options'
```

3. Pass criteria:
- non-`404` status
- `access-control-allow-origin` present for browser requests

4. Post-deploy smoke tests:
- `GET /players?season=season2`
- `GET /game-records?season=season2`
- `GET /draft/state?season=season2`

### Troubleshooting signature: CORS + 404
If browser shows:
- `No 'Access-Control-Allow-Origin' header`
- and the same URL is `404` in network logs,

the route is missing/not deployed on that stage. Fix deployment first.

## One-time offseason migration command

Script:
- `scripts/aws/offseason-migrate-season-data.sh`

What it does:
- snapshots legacy tables,
- creates new tables if missing,
- backfills `PlayerLifetime`, `PlayerSeason`, `GameRecordsV2`, `DraftState`,
- upserts `seasonCatalog` in `GameOptions`,
- optionally updates Lambda env vars for cutover,
- tags legacy tables as `migrationStatus=legacy-frozen`.

### Example run (dry-safe default)
```bash
AWS_REGION=us-east-1 \
AWS_PROFILE=inseason-admin \
CURRENT_SEASON_ID=season2 \
SEASON1_ID=season1 \
bash scripts/aws/offseason-migrate-season-data.sh
```

### Apply Lambda env cutover in same run
```bash
AWS_REGION=us-east-1 \
AWS_PROFILE=inseason-admin \
APPLY_LAMBDA_ENV_CUTOVER=true \
HTTP_API_FUNCTION_NAME=inseason-http-api \
CHECK_GAME_FUNCTION_NAME=inseason-check-game \
bash scripts/aws/offseason-migrate-season-data.sh
```

### Key env vars written during cutover
- `PLAYER_SEASON_TABLE`
- `PLAYER_LIFETIME_TABLE`
- `GAME_RECORDS_V2_TABLE`
- `DRAFT_STATE_TABLE`
- `DEFAULT_SEASON`
- `SEASON_CATALOG_ID`

## Post-migration validation

1. Lifetime parity:
- For each player, `championships` and `totalDefenses` match pre-migration values.

2. Season parity:
- Per season, `teams` and `titleDefenses` match source tables.

3. API parity:
- Validate:
  - `GET /players`
  - `GET /players/:name`
  - `GET /game-records`
  - `GET /champion/history`

4. Draft safety:
- In-season mutations return `409`.
- Draft state reads/writes are isolated by `draftId=seasonId`.

## Rollback

1. Restore from snapshot JSONs in `tmp/season-data-migration/<timestamp>/`.
2. Revert Lambda env vars to legacy table variables.
3. Redeploy previous Lambda package if needed.
4. Keep legacy tables until rollback confidence window ends.
