# Season isolation and rollover operations

Implementation is opt-in (`SEASON_STORAGE=v2`). Phase 3 only rehearses disposable
copies. Production cutover, schedules and IAM/configuration changes require a
separate review. Phase 4 redesign is independent of this storage cutover.

## Storage contract

| Environment variable | Key |
| --- | --- |
| PLAYER_LIFETIME_TABLE | id (string) |
| SEASON_CATALOG_TABLE | id (string) |
| SEASON_PLAYERS_TABLE | seasonId (string), id (string) |
| SEASON_RECORDS_TABLE | seasonId (string), id (number) |
| SEASON_OPTIONS_TABLE | seasonId (string), id (string) |

All five tables must be distinct. Catalog `catalog` chooses the default season;
`seasonN` rows carry status, revision, writersEnabled, label, dates and NHL game-ID
prefix. `migration` retains source fingerprint, exceptions and unassigned legacy
draft provenance. Never derive the current season from a table suffix or year.

Season 1/2 player rows preserve their historical snapshots. Lifetime totals are
initialized once from explicitly accepted current totals, not summed cumulative
snapshots. Season 3 copies those totals but starts with zero seasonal defenses,
empty rosters, independent draft version 0 and no starting champion. No dates or
starting champion are guessed. The initial catalog is preseason with writers off.

Every canonical write transaction checks the catalog status/revision/write flag.
Drafts write only in preseason. Checker writes require active status. Game ledger,
season counters, lifetime defenses and champion transition commit together.
Closeout selects most defenses, then champion-team owner, then alphabetical name;
it increments seasonal snapshot and lifetime championship once while archiving
that season in the same transaction. Archived reads never use current-season
ownership or current live game state.

`/seasons` provides the frontend catalog. Invalid/unknown seasons fail, rather
than silently selecting another table. Existing saved selections remain valid;
new visitors get the catalog default. Missing legacy `/seasons` (404) falls back
to Seasons 1/2; other failures prevent loading interactive pages. Season 3 uses
Season 2's existing artwork pending the separately planned redesign.

## Plan and rehearsal

Use yarn for dependencies. The CLI defaults to local DynamoDB and read-only plans.
`--aws` explicitly selects AWS credentials from the operator environment. No CLI
command deploys Lambdas, changes IAM, deletes tables, or modifies legacy sources.
Keep all inputs, snapshots, outputs and profile values outside git.

The source JSON is an object mapping legacy table names to **document-format**
item arrays: Players, Players-Season1, PlayersDraft, Players-restore-20260314,
GameRecords, GameRecords-Season1, GameOptions and DraftState. Preserve optional
restored sources too. Obtain paginated consistent scans of each exact table,
validate DescribeTable key types, and retain original raw DynamoDB exports and
checksums alongside it. Do not export secrets or Lambda environment variables.

```sh
node scripts/season/rollover.cjs plan --source /private/source.json \
  --output /private/plan.json --accept-stored-totals
node scripts/season/rollover.cjs create --prefix isc-phase3-review- --apply
node scripts/season/rollover.cjs apply --prefix isc-phase3-review- \
  --manifest /private/plan.json --source /private/source.json
node scripts/season/rollover.cjs apply --prefix isc-phase3-review- \
  --manifest /private/plan.json --source /private/source.json --apply
node scripts/season/rollover.cjs snapshot --prefix isc-phase3-review- \
  --output /private/backup.json
node scripts/season/rollover.cjs create --prefix isc-phase3-restore- --apply
node scripts/season/rollover.cjs apply --prefix isc-phase3-restore- \
  --manifest /private/backup.json --apply
```

Add `--aws` to each AWS command; select `<AWS_PROFILE>` and `<AWS_REGION>` privately.
The prefix must be explicit (`isc-phase3-<run>-` for rehearsal or
`isc-season-<version>-` for a separately approved cutover). Existing table schema
and every existing row are compared before any write. Missing rows are inserted
conditionally; identical reruns skip rows, changed/unexpected rows stop the run.
This permits resuming partial initialization but never resets a season after play.
The manifest and current source fingerprints must match. Do not delete conflicts
to force a rerun: investigate or choose fresh disposable tables.

`yarn test:integration` creates/destroys uniquely named local disposable tables.
For an explicitly authorized AWS rehearsal only:

```sh
DYNAMODB_TEST_AWS=true SEASON_REHEARSAL_SOURCE=/private/source.json \
  node --test tests/integration/season-rollover.test.cjs
```

The test guards every data operation to its own random prefix. It migrates,
repeats migration, snapshots/restores to separate tables, drafts all 32 teams,
activates, finalizes twice, closes out twice and compares archive/restore hashes.
Cleanup only deletes tables bearing that run's random prefix. If interrupted,
inspect and remove only that prefix; never use broad table-delete patterns.

## Lifecycle operations

Use `transition --prefix ... --request /private/transition.json` to display the
request, then explicit `--apply` to execute. The display is not a preflight
simulation: schema/state/roster/concurrency validation runs at execution. Requests
must contain seasonId, expectedRevision and status. Supported transitions:

- preseason → preseason: enables writes, after authorization prerequisites pass.
- preseason → active: requires a complete 32-team draft, starting `champion`,
  `regularSeasonEnd` and `playoffsStart`. It pins draft version and all rosters.
- active → archived: requires final game completed, no active game, and pins the
  game ledger marker, rosters and defense counters. A retry does not award again.

Checker trigger JSON must include `seasonId`. Legacy events without it and late
archived-season events are rejected. Self-schedule names include season ID and
propagate it. The catalog NHL game prefix rejects a game from a different year.
Package via `yarn package:lambdas`: root index.handler shims include the runtime
module directory plus shared modules. Uploading only the old index.js is invalid.

## Production cutover checklist (separate authorization)

1. Resolve/accept the audit exceptions, verify source keys and stable identities,
   confirm starting champion and dates, and settle #29/#36 participant/admin
   authorization. Require least-privilege roles restricted to canonical targets;
   remove legacy writers' ability to change archived tables.
2. Inventory all API/Lambda writers, WebSocket handlers, scheduler groups, event
   rules, in-flight requests, retries and deployment aliases. Disable mutations
   and discovery/self-schedules. Drain invocations and retry queues. Record exact
   prior configuration privately. Verify counters/options no longer change.
3. Create on-demand backups for every affected source, verify AVAILABLE, and
   perform a real DynamoDB backup restore to disposable tables. Phase 3's
   document-export restore is useful evidence but does **not** verify AWS managed
   backup restoration. Retain backup ARNs privately. Enable approved retention
   and PITR for canonical tables before re-enabling writes.
4. Take final quiescent exports. Rebuild/inspect the plan against them; never use
   the September audit snapshot as the cutover backup. Create fresh canonical
   tables, run dry preflight then apply, repeat to prove no-op, and verify exact
   archived row parity and accepted lifetime counters with a saved snapshot.
5. Deploy both complete Lambda packages, map all five table environment variables,
   deploy the compatible frontend, confirm season-aware cache keys and invalidate
   old cached responses. Keep catalog writers disabled and schedules stopped.
   Verify Season 1/2 ownership/history and empty Season 3 through public reads.
6. Review the rollback checkpoint. Only then enable preseason writes with a
   revision-checked transition. Later, after the draft and dates are verified,
   activate Season 3 and explicitly configure season-tagged discovery triggers.
   Recheck that legacy integrations cannot write and that no Season 2 schedule
   can write Season 3. Monitor duplicate finalization and failed transactions.

## Rollback boundary

Before any new-season writes: keep writers/schedules stopped, restore the saved
Lambda/frontend/configuration versions and original table references, invalidate
caches, verify original sources. Retain canonical copies for investigation.

After new-season writes: **do not switch back to old tables**; that loses new
picks/games/counters. Quiesce again, snapshot canonical state, compare accepted
ledger writes, and review a forward repair or a data-preserving restore into new
tables. Restore all related tables to one verified logical checkpoint, never
just the lifetime table or draft row. Changing revision/write flags alone does
not stop an old Lambda that does not enforce them; disable its triggers/role too.
