# Season Data Runbook

## Current backend behavior
- The HTTP API accepts `?season=seasonN` (or `?season=N`) on data endpoints.
- If `season` is omitted, the API uses `DEFAULT_SEASON` (fallback: `season2`).
- Table resolution rules in `lambdas/http-api/index.js`:
  - `season2` uses `PLAYERS_TABLE` and `GAME_RECORDS_TABLE`.
  - `seasonN` (`N != 2`) uses:
    - `PLAYERS_TABLE_SEASONN` / `GAME_RECORDS_TABLE_SEASONN` when provided.
    - Otherwise defaults to `<PLAYERS_TABLE>-SeasonN` and `<GAME_RECORDS_TABLE>-SeasonN`.

## Supported season-aware endpoints
- `GET /players`
- `GET /players/:name`
- `POST /players/reset-teams`
- `PATCH /players/:id/teams`
- `GET /game-records`
- `GET /champion/history`
- `GET /champion`
- `GET /gameid`
- `GET /check-status`
- `GET /season/meta`
- `GET /draft/state`
- `PATCH /draft/state`
- `POST /draft/select-team`

## Draft write lock (active season protection)
- Draft/team mutation routes are blocked during active season:
  - `POST /players/reset-teams`
  - `PATCH /players/:id/teams`
  - `PATCH /draft/state`
  - `POST /draft/select-team`
- Allowed windows:
  - Pre-season (no game records yet for the selected season), or
  - Off-season (`seasonOver=true` from season metadata).
- In-season writes return `409` with a lock message.
- Emergency override (operators only): set `ALLOW_IN_SEASON_DRAFT_WRITES=true` on `inseason-http-api`.

## Contract deployment verification checklist
Use this checklist any time frontend code depends on new HTTP API routes (for example PR #48 season contracts).

1. Verify routes exist on the target API/stage:
   - `GET /season/meta`
   - `GET /champion/history`
2. Verify CORS from local-dev origin:
   - `curl -i -H 'Origin: http://localhost:8080' 'https://<api-id>.execute-api.us-east-1.amazonaws.com/<stage>/season/meta?season=season2'`
   - `curl -i -H 'Origin: http://localhost:8080' 'https://<api-id>.execute-api.us-east-1.amazonaws.com/<stage>/champion/history?season=season2&limit=6'`
3. Pass criteria:
   - Non-`404` status on both endpoints.
   - Response includes `access-control-allow-origin` for browser requests.
4. Run post-deploy smoke tests:
   - `GET /champion?season=season2`
   - `GET /season/meta?season=season2`
   - `GET /champion/history?season=season2&limit=6`

### Troubleshooting: Browser CORS error + endpoint 404
If you see browser errors like:
- `blocked by CORS policy: No 'Access-Control-Allow-Origin' header`
- paired with failed requests to `/season/meta` or `/champion/history`

Then check the same endpoint with `curl -i` first. A `404` response from API Gateway without CORS headers means the route is missing or not deployed on that stage yet. Fix route/deployment first; frontend fallback should stay non-blocking locally, but production should not rely on fallback.

## New season rollover checklist
1. Pick the season ID you will use (example: `season3`).
2. Create season tables (or decide to keep shared tables and add `seasonId` attributes).
3. Configure Lambda env vars for the new season tables and metadata:
   - `DEFAULT_SEASON=season3`
   - `PLAYERS_TABLE_SEASON3=<players-table-name>`
   - `GAME_RECORDS_TABLE_SEASON3=<game-records-table-name>`
   - `SEASON3_REGULAR_SEASON_END=<YYYY-MM-DD>`
   - `SEASON3_PLAYOFFS_START=<YYYY-MM-DD>`
   - Optional: `SEASON3_SEASON_OVER=true|false`
4. Deploy `lambdas/http-api/index.js` with the updated env vars.
5. Verify:
   - `GET /season/meta?season=season3`
   - `GET /players?season=season3`
   - `GET /game-records?season=season3`
6. If using Draft in the new season, initialize draft state by calling `GET /draft/state?season=season3` once.

## AWS CLI snippets
```bash
# Read current Lambda env so you can merge instead of overwriting blindly.
aws lambda get-function-configuration \
  --function-name inseason-http-api \
  --query 'Environment.Variables'

# Example update (replace placeholders and include your existing variables).
aws lambda update-function-configuration \
  --function-name inseason-http-api \
  --environment 'Variables={
    AWS_REGION=us-east-1,
    PLAYERS_TABLE=Players,
    GAME_RECORDS_TABLE=GameRecords,
    GAME_OPTIONS_TABLE=GameOptions,
    DEFAULT_SEASON=season3,
    PLAYERS_TABLE_SEASON3=Players-Season3,
    GAME_RECORDS_TABLE_SEASON3=GameRecords-Season3,
    SEASON3_REGULAR_SEASON_END=2027-04-15,
    SEASON3_PLAYOFFS_START=2027-04-18
  }'
```

## Recommended future improvement (single-table accumulation)
If you want seasons to accumulate without yearly table cloning:
1. Add `seasonId` to `Players` and `GameRecords`.
2. Add GSIs keyed by `seasonId` for query efficiency.
3. Keep one table per entity and query by `seasonId` instead of per-season table names.
4. Backfill historical records with `seasonId` values.

This removes annual table-copy work and keeps season transitions operationally lighter.
