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
