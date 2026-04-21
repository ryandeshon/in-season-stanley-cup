# Season Closeout Runbook

This runbook covers the Season 2 closeout flow added for the `2.4.0` transition.

## Goals
- Mark season-over state explicitly in backend metadata.
- Increment the winning player's lifetime `championships` exactly once.
- Refresh API cache immediately after draft start and on a monthly schedule during offseason.

## 1) Apply season champion award (idempotent)

Use the closeout helper script:

```bash
# Dry run first (default DRY_RUN=true)
scripts/aws/closeout-season.sh

# Apply changes
DRY_RUN=false scripts/aws/closeout-season.sh
```

Default assumptions:
- `SEASON_ID=season2`
- `HTTP_API_FUNCTION_NAME=inseason-http-api`
- champion is selected by highest `titleDefenses`
- tie-break by owner of current `GameOptions.currentChampion`

What the script does:
- Resolves season players table from Lambda env.
- Selects champion by `titleDefenses` ranking.
- Increments `championships` once with a conditional write guarded by `lastChampionshipAwardSeason`.
- Sets `SEASON2_SEASON_OVER=true` on the HTTP API Lambda env.

## 2) Draft-start cache clear

`PATCH /draft/state` now triggers API CloudFront invalidation when `draftStarted` transitions `false -> true`.

Required Lambda env vars on `inseason-http-api`:
- `API_CACHE_DISTRIBUTION_ID`
- `API_CACHE_INVALIDATION_PATHS` (comma-separated)

## 3) Monthly offseason cache clear

Deploy `lambdas/monthly-cache-clear` and configure scheduler:

```bash
SCHEDULER_ROLE_ARN=<role-arn-with-lambda-invoke> \
scripts/aws/setup-monthly-cache-clear.sh
```

Defaults:
- schedule name: `inseason-monthly-cache-clear`
- expression: `cron(0 08 1 * ? *)` (1st day of month, 08:00 UTC)

## Verification
- Confirm champion award write:
  - winner's `championships` incremented by `1`
  - `lastChampionshipAwardSeason` equals `season2`
- Confirm season metadata:
  - `GET /season/meta?season=season2` returns `seasonOver: true`
- Confirm invalidation behavior:
  - Draft start logs show invalidation request from HTTP API Lambda.
  - Monthly Lambda logs show successful CloudFront invalidation request.

