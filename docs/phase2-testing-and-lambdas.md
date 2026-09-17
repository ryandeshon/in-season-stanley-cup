# Phase 2 tests and Lambda packaging

Run with Node 22 and Yarn:

```sh
yarn install --frozen-lockfile
yarn test:unit
yarn test:backend
yarn test:e2e
yarn lint --no-fix
yarn build
yarn package:lambdas
```

`test:backend` includes API contracts, scheduler behavior and the original checker
rule tests. Browser tests use the isolated localhost fixture server from Phase 1;
unknown application/NHL requests still fail. The full-suite CI gate requires at
least 29 tests and rejects pending/skipped tests.

## Persistence tests

Run DynamoDB Local on localhost:8000, then `yarn test:integration`. GitHub's
required `unit-tests` job supplies an isolated DynamoDB Local service, with no
AWS credentials. Tests require `jq` and `bash` for the existing closeout script.

For an explicitly authorized AWS rehearsal with synthetic data:

```sh
DYNAMODB_TEST_AWS=true AWS_PROFILE=<AWS_PROFILE> AWS_REGION=<AWS_REGION> yarn test:integration
```

Every run creates uniquely named `isc-phase2-test-<random>-*` tables; all tested
DynamoDB operations are checked against that run's prefix. The suite deletes its
tables on completion, including assertion failures. An externally killed process
can bypass cleanup: inspect and remove only that run's disposable tables afterward.
No test reads or resets production tables. The closeout shell script uses a test
CLI shim that permits only these tables and captures Lambda configuration changes
in a temporary local file. It never calls a real Lambda configuration endpoint.

Covered: concurrent versioned picks, undo, conditional-write rollback, exactly-once
defenses under duplicate/concurrent finalization, failure/retry, non-regular games,
live check state, legacy-record preservation, and closeout dry-run/concurrent/rerun
award safety. Synthetic archive rows and existing lifetime totals are asserted.
These checks do not replace Phase 3's production-data reconciliation or migration
rehearsal.

## Runtime artifacts and deployment prerequisites

`yarn package:lambdas` creates ignored `http-api.deploy.zip` and
`check-game.deploy.zip`. It checks JavaScript syntax and relative imports, includes
all runtime modules at the archive root, and excludes tests. The HTTP package
includes its ESM `package.json`; checker remains CommonJS. Do not deploy only the
small new `index.js` files: their sibling modules are required.

Entrypoints remain `index.handler`. Runtime code still uses the existing AWS SDK
v2 dependency supplied by the deployment/layer. The new SDK v3 dev dependencies
are for persistence tests and are not included in these ZIPs. Verify the deployed
runtime/layer provides `aws-sdk` before a separately approved deployment.

Finalization now uses one DynamoDB transaction for a conditional game-record Put,
GameOptions Update, and (when an owner exists) player-counter Update. Verify the
execution role permits the underlying `PutItem`, `UpdateItem`, `GetItem` and `Scan`
actions on the configured tables, including any `dynamodb:EnclosingOperation`
restrictions. Transaction permissions use the underlying actions, as documented
in [AWS transaction IAM guidance](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html).
Tables must be in the same account and Region.

New records carry `statsApplied` and `defensePlayerId` audit fields. Existing game
records are left unchanged and never used to guess whether legacy counters need
repair. Phase 3 must reconcile possible older missed credits against authoritative
data. No table reset, season rollover, IAM update, Lambda deployment, or production
counter repair is included in Phase 2.

Before deployment, retain the previous complete Lambda ZIPs and configuration.
Rollback restores those artifacts; it does not delete game records or decrement
counters. Reverting the checker restores its old partial-write risk, so pause
writers and reconcile any failures before resuming. A future schema migration
needs its own backup/restore rehearsal and cutover review.
