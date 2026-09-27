const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transition } = require('../../lambdas/shared/season-lifecycle.cjs');
const tables = { catalog: 'catalog', players: 'players', options: 'options' };
function fixture() {
  let written;
  const players = Array.from({ length: 4 }, (_, i) => ({
    id: String(i),
    teams: Array.from({ length: 8 }, (_, j) => `T${i * 8 + j}`),
    titleDefenses: 0,
  }));
  const db = {
    get: ({ TableName, Key }) => ({
      promise: async () => ({
        Item:
          TableName === 'catalog'
            ? { id: 'season3', status: 'preseason', revision: 3 }
            : Key.id === 'draftState'
              ? { state: { availableTeams: [], version: 70 } }
              : { champion: null },
      }),
    }),
    query: () => ({ promise: async () => ({ Items: players }) }),
    transactWrite: (value) => ({
      promise: async () => {
        written = value;
      },
    }),
  };
  return { db, written: () => written };
}
const request = {
  status: 'active',
  champion: 'T0',
  regularSeasonStart: '2026-09-29',
  regularSeasonEnd: '2027-04-10',
};
test('activation records verified regular-season dates without inventing playoffs', async () => {
  const f = fixture();
  const result = await transition(f.db, tables, 'season3', 3, request);
  assert.equal(result.season.regularSeasonStart, request.regularSeasonStart);
  assert.equal(result.season.playoffsStart, null);
  assert.equal(result.season.revision, 4);
  assert.equal(
    f
      .written()
      .TransactItems.filter((i) => i.ConditionCheck?.TableName === 'players')
      .length,
    4
  );
  assert.ok(
    f
      .written()
      .TransactItems.some(
        (i) => i.ConditionCheck?.ExpressionAttributeValues?.[':v'] === 70
      )
  );
});
test('activation rejects invalid calendar ranges before writing', async () => {
  for (const override of [
    { regularSeasonEnd: null },
    { regularSeasonStart: '2027-04-11' },
    { playoffsStart: '2027-04-01' },
  ]) {
    const f = fixture();
    await assert.rejects(
      transition(f.db, tables, 'season3', 3, { ...request, ...override }),
      /season dates/
    );
    assert.equal(f.written(), undefined);
  }
});
