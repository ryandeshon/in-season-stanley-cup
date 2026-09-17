const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../fixtures/season-source.cjs');
const { planMigration, hash } = require('../../scripts/season/migration.cjs');
const {
  collect,
  scopedClient,
} = require('../../lambdas/shared/season-storage.cjs');
test('migration rejects ambiguous identities and conflicting roster recovery', () => {
  const source = fixture();
  source.Players[0].id = '1';
  assert.throws(() => planMigration(source), /identit/);
  const roster = fixture();
  roster['Players-restore-20260314'] = structuredClone(
    roster['Players-restore-20260314']
  );
  roster['Players-restore-20260314'][0].teams = ['BOS'];
  assert.throws(() => planMigration(roster), /sources must agree/);
});
test('discrepancies require acknowledgment and never silently repair lifetime totals', () => {
  const source = fixture();
  source.Players[2].totalDefenses = 17;
  assert.throws(() => planMigration(source), /acknowledgment/);
  const plan = planMigration(source, { acceptStoredTotals: true });
  assert.equal(plan.rows.lifetime.find((p) => p.id === '2').totalDefenses, 17);
  assert.equal(
    plan.rows.players.find((p) => p.id === '2' && p.seasonId === 'season3')
      .titleDefenses,
    0
  );
  assert.equal(plan.anomalies.length, 1);
  assert.deepEqual(
    plan.rows.catalog.find((p) => p.id === 'migration').legacyDraftSource,
    source.DraftState
  );
  assert.equal(hash(plan.rows), plan.targetHash);
});
test('wrong-year games and duplicate archived owners fail preflight', () => {
  const source = fixture();
  source.GameRecords[0].id = 2024020001;
  assert.throws(() => planMigration(source), /Invalid game season/);
  const other = fixture();
  other['Players-Season1'][0].teams[0] = other['Players-Season1'][1].teams[0];
  assert.throws(() => planMigration(other), /Duplicate teams/);
});
test('collection consumes every DynamoDB page and forwards exclusive start keys', async () => {
  let calls = 0;
  const db = {
    scan: (p) => ({
      promise: async () => {
        calls++;
        if (calls === 1)
          return { Items: [1], LastEvaluatedKey: { id: 'cursor' } };
        assert.deepEqual(p.ExclusiveStartKey, { id: 'cursor' });
        return { Items: [2] };
      },
    }),
  };
  assert.deepEqual(await collect(db, 'scan', { TableName: 'test' }), [1, 2]);
});
test('archived scoped writes fail before reaching DynamoDB', async () => {
  const db = {
    transactWrite: () => {
      throw new Error('should not call');
    },
  };
  const scoped = scopedClient(
    db,
    { players: 'players', catalog: 'catalog' },
    { id: 'season1', status: 'archived', revision: 1, writersEnabled: false },
    'preseason'
  );
  await assert.rejects(
    scoped.put({ TableName: 'players', Item: { id: '0' } }).promise(),
    /disabled/
  );
});
test('canonical admin authorization is fail-closed without a configured token', async () => {
  const { createHttp } = await import('../../lambdas/http-api/http.js');
  assert.equal(
    createHttp({ env: { SEASON_STORAGE: 'v2' } }).isAuthorized({}),
    false
  );
  assert.equal(
    createHttp({
      env: { SEASON_STORAGE: 'v2', ADMIN_API_TOKEN: 'test-only' },
    }).isAuthorized({ headers: { 'X-Admin-Token': 'test-only' } }),
    true
  );
});
