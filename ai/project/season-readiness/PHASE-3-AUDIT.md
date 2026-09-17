# Phase 3 inventory and reconciliation — 2026-09-17

Read-only production inventory; no production writes, deployment, backup creation,
configuration changes or schedule changes were performed. Raw exports and runtime
configuration evidence are private, outside git. These scans are consistent per
read but are **not a globally quiescent production backup**.

## What exists

| Source | Rows | Purpose |
| --- | ---: | --- |
| Current players | 4 | Authoritative provisional lifetime baseline and Season 2 seasonal counters |
| Season 1 players | 4 | Archived rosters and seasonal counters |
| Draft players | 4 | Season 2 roster recovery source |
| March player restore | 4 | Independent corroboration of all Season 2 rosters |
| Season 1 game records | 87 | Preserved verbatim |
| Restored game records | 87 | Content exactly matches Season 1 after sorting by ID |
| Season 2 game records | 69 | Preserved verbatim |
| Game options | 2 | Champion/checker row and reset draft-state row |
| Legacy draft state | 1 | Surviving source of uncertain season; preserved as unassigned provenance |

Player IDs are strings, including Ryan's `"0"`. Game IDs are numeric. Current
players have **no teams attribute**; both independent recovery sources agree on
all 32 Season 2 assignments. Neither source's old statistics replace current
statistics. The previous frontend fallback silently substituted Season 1 rosters;
fallback is now limited to missing Season 1 rosters and never replaces `teams: []`.

## Counters and unresolved exception

| Player | Season 1 defenses | Stored Season 2 defenses | Season 2 recorded wins | Stored lifetime defenses | Championships |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ryan | 19 | 24 | 24 | 43 | 1 |
| Cooper | 31 | 19 | 19 | 50 | 1 |
| Terry | 23 | 11 | 10 | 28 | 0 |
| Boz | 14 | 16 | 16 | 30 | 0 |

Ryan has an existing Season 2 championship award marker. Initialization does not
award it again. Season 1 records reproduce all four archived defense counters.

**Review required:** Terry has two discrepancies: 11 stored Season 2 defenses
versus 10 recorded wins, and 28 stored lifetime defenses versus a sum of 34 across
stored season snapshots. The rehearsal explicitly preserves 28 and 11; no repair
or inferred award is made. The migration requires an explicit stored-baseline
acknowledgment and records the exceptions. That rehearsal acknowledgment is not
production approval; the maintainer must accept or reconcile the baseline before
cutover.

The GameOptions draft was reset after the season. Its original pick history is
unavailable; the separate legacy DraftState is not enough to assign/reconstruct
that history reliably. Preserve raw survivors and mark history unavailable rather
than inventing picks. Archived rosters, games and counters remain available.

## Operational findings

- PITR is enabled only for current Players (35 days). The other eight inventoried
  tables have no PITR. ContinuousBackupsStatus alone does not establish PITR.
- The checker updated its status on the audit date despite the season being over.
  Self-scheduling remains enabled. Cutover must quiesce discovery triggers,
  outstanding self-schedules, in-flight invocations and legacy write endpoints.
- Deployed HTTP/checker code predates the merged Phase 2 code. A git merge is not
  evidence of Lambda deployment.
- Legacy draft/select-team and update functions still exist. Inventory their
  integrations, triggers, permissions and callers before re-enabling writes.
- The deployed HTTP API uses long offseason cache settings. Confirm the CDN key
  includes `season`, bypass mutations/admin headers, and invalidate old cached
  season/catalog/roster/status responses during cutover.
- #29/#36 remain authorization prerequisites. Canonical admin mutations fail
  closed without a configured token; a token entered on the admin page stays in
  memory and is cleared on unmount. This is not participant identity or full
  login (#53). Public pick requests still need their actor bound to an authorized
  player before an Internet-accessible draft is enabled. New migration catalogs
  deliberately start with writers disabled.
