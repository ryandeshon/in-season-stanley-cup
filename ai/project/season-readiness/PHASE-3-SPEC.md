# Phase 3 — season isolation and rollover rehearsal

Authorized after merge of #75. Branch: isc-028-season-isolation-rollover; issue #28.
Stop for review at completion. Production cutover remains a separate approval.

1. Read-only inventory of deployed tables/configuration, keys, player identity,
   records and season closeout markers. Store raw exports privately outside git;
   publish only a sanitized reconciliation report.
2. Implement explicit season catalog/default/status and season-scoped API, draft,
   checker and closeout persistence. Preserve archived roster ownership and games;
   separate lifetime counters from fresh seasonal fields. Keep legacy reads
   compatible until a deliberate configuration cutover.
3. Implement dry-run-first migration with schema/identity preflight, content
   fingerprints, rerun safety and no guessed historical repairs. Require an
   explicit authoritative lifetime baseline if legacy sources disagree.
4. Rehearse backup/restore and rollover on disposable copies. Verify exact
   historical parity, unchanged lifetime counters at initialization, zero new
   defenses, independent drafts, and exactly-once game/closeout operations.
5. Extend required contracts/unit/browser/persistence tests, package the Lambdas,
   prepare the cutover/rollback runbook and draft PR. Do not deploy or mutate
   production tables, Lambda configuration, cache configuration or schedules.

## Tasks

- DONE: read-only inventory and reconciliation; baseline exception documented for review.
- DONE: isolate catalog/API/draft/checker/closeout and connect frontend selection.
- DONE: dry-run migration, repeatable copy rehearsal and demonstrated document-snapshot restore.
- DONE: local tests, runbook and patch changeset; draft PR/CI review checkpoint pending.
