# Phase 3 review — season isolation and rollover

Issue #28; follows merged #75. This checkpoint implements storage isolation and
rehearsal tooling. **No production cutover or redesign is included.**

## Delivered

- Five explicit opt-in canonical tables separate lifetime counters, season
  catalog, season players, games and options/drafts. Legacy mode remains available.
- Source-aware migration preserves all 87 Season 1 and 69 Season 2 game records,
  recovers Season 2 rosters only from agreeing independent sources, and carries
  accepted current lifetime totals into fresh Season 3 players with zero seasonal
  defenses and empty rosters. Existing championship awards are not repeated.
- Version/status checks guard all canonical writes. Draft reset is atomic;
  checker game/stat/champion writes include lifetime stats atomically. Closeout
  awards once and archives atomically. Events must name their active season.
- The UI loads a season catalog and preserves valid explicit selections. Archived
  draft pages are read-only, new-season empty rosters stay empty, and player ID 0
  works. Cross-season socket updates refresh the selected season instead of
  applying an unscoped payload. Existing artwork remains pending Phase 4.
- Migration defaults to dry-run, verifies identities/schema/fingerprints and
  refuses changed target content. It supports safe partial initialization and
  exact document-snapshot restore into separate empty tables.

## Evidence

Disposable AWS rehearsal used private copies of the actual database, with every
operation restricted to this run's random test-table prefix. It confirmed exact
backup/restore parity, harmless migration reruns, immutable Season 1/2 rows,
carried lifetime baselines, empty new rosters, a complete 32-team draft, stale-write
rejection after activation, and exactly-once game finalization and closeout.
The source production tables were read only. Test and restore tables are removed
by the harness. Raw exports and test logs stay outside git.

Local checks: 83 frontend unit tests, 22 backend contracts, 8 legacy persistence
tests and the canonical lifecycle rehearsal, and all 32 Cypress scenarios.
Production build, lint and complete Lambda packaging pass. The security scan
retains the same pre-existing baseline matches; no new secret matches were added.
CI results are recorded in the PR. Required persistence
coverage remains inside the already-required unit-tests workflow. The Cypress
full-suite minimum increases from 29 to 32; skipped/pending tests still fail.

## Review decisions and cutover prerequisites

1. Terry's stored Season 2 defenses are 11 but recorded wins total 10; stored
   lifetime defenses are 28 but the season snapshots sum to 34. Rehearsal preserves
   the stored values without repair. Accept or reconcile this baseline before
   applying to production. See PHASE-3-AUDIT.md.
2. Original draft pick history was already reset in the source. Surviving legacy
   draft data is retained as unassigned provenance, not presented as reconstructed
   Season 1/2 pick history.
3. New catalog writers default off. #29/#36 still need actor authorization before
   exposing a live public draft. An admin token is not full participant login.
4. Approve actual Season 3 dates and starting champion at activation. No defaults
   were guessed. A complete draft is required before enabling the game checker.
5. Production cutover needs a separate window, final quiescent backups, managed
   backup-restore verification, legacy-writer and schedule shutdown, least-privilege
   IAM, complete Lambda deployment and cache verification/invalidation. After any
   new-season writes, rollback must preserve those writes rather than reverting
   to the old database. See docs/season-rollover-v2.md.

Stop here for review. Phase 4 awaits the separately prepared redesign guide.
