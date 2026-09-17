# Phase 2 — behavior coverage and refactoring

Approved after merge of #73. Branch: isc-030-phase2-behavior-refactors; related #30.

Implement shared request lifecycle and draft countdown behavior with race/cleanup
tests. Restore API contracts and split Lambda transport, domain, persistence and
scheduling concerns behind injected dependencies. Exercise draft transactions and
checker retries against disposable DynamoDB tables, with synthetic data only.
Expand browser scenarios for draft/error/recovery and season-aware reads.

Keep schema migration and historical production reconciliation in Phase 3. Tests
must distinguish supported legacy behavior from known missing multi-season
guarantees. Track newly reproduced defects separately from mechanical extraction;
do not silently normalize or repair existing production totals.

Verification: focused tests before/after extraction, unit/checker/contract suites,
isolated persistence tests, Cypress, lint, build, and Lambda packaging checks.
Do not deploy Lambda changes or alter production tables. Stop for Phase 2 review.

## Tasks

- DONE: characterize season/profile races and extract shared loading.
- DONE: extract/test draft countdown and action state; cover realtime cleanup.
- DONE: restore API contract tests and extract route/domain/repository modules.
- DONE: characterize checker partial failures and isolate scheduler/persistence.
- DONE: verify transactions/retries with disposable DynamoDB tables.
- DONE: expand browser behavior cases; document Phase 3 contract gaps.
- DONE: verify release artifacts and prepare draft PR/review checkpoint (#75).
