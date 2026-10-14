const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../../lambdas/live-broadcast/handler.cjs');
function setup({
  active = true,
  gameId = 42,
  pages = [[{ connectionId: 'a' }]],
  error,
  changed = false,
  fetchError = false,
} = {}) {
  const sent = [],
    deleted = [];
  let reads = 0,
    scans = 0,
    fetched = 0;
  const db = {
    get: ({ TableName, Key }) => ({
      promise: async () => ({
        Item:
          TableName === 'catalog'
            ? Key.id === 'catalog'
              ? { defaultSeason: 'season3' }
              : { status: active ? 'active' : 'archived' }
            : { activeGameId: changed && reads++ ? 99 : gameId },
      }),
    }),
    scan: () => ({
      promise: async () => {
        const index = scans++;
        return {
          Items: pages[index],
          ...(index < pages.length - 1
            ? { LastEvaluatedKey: { connectionId: 'next' } }
            : {}),
        };
      },
    }),
    delete: ({ Key }) => ({
      promise: async () => {
        deleted.push(Key.connectionId);
      },
    }),
  };
  const handler = createHandler({
    db,
    env: {
      SEASON_CATALOG_TABLE: 'catalog',
      SEASON_OPTIONS_TABLE: 'options',
      SOCKET_CONNECTIONS_TABLE: 'connections',
    },
    log: { info() {}, error() {} },
    getGame: async (id) => {
      fetched++;
      if (fetchError) throw new Error('NHL down');
      return {
        id,
        gameState: 'LIVE',
        homeTeam: { score: 1 },
        awayTeam: { score: 0 },
      };
    },
    post: async (id, data) => {
      if (error && id === 'a') throw error;
      sent.push({ id, data: JSON.parse(data) });
    },
  });
  return { handler, sent, deleted, fetched: () => fetched };
}
test('publishes the canonical active game to every page of clients', async () => {
  const f = setup({
    pages: [[{ connectionId: 'a' }], [{ connectionId: 'b' }]],
  });
  assert.deepEqual(await f.handler(), {
    seasonId: 'season3',
    gameId: 42,
    sent: 2,
    stale: 0,
    failed: 0,
  });
  assert.equal(f.sent[0].data.type, 'liveGameUpdate');
  assert.equal(f.sent[0].data.payload.id, 42);
});
test('does not fetch NHL data for archived seasons, off days, or no viewers', async () => {
  for (const options of [
    { active: false },
    { gameId: null },
    { pages: [[]] },
  ]) {
    const f = setup(options);
    await f.handler();
    assert.equal(f.fetched(), 0);
    assert.equal(f.sent.length, 0);
  }
});
test('removes gone connections while still delivering to healthy viewers', async () => {
  const f = setup({
    pages: [[{ connectionId: 'a' }, { connectionId: 'b' }]],
    error: { $metadata: { httpStatusCode: 410 } },
  });
  const result = await f.handler();
  assert.equal(result.sent, 1);
  assert.equal(result.stale, 1);
  assert.deepEqual(f.deleted, ['a']);
});
test('reports permission errors without deleting healthy connection records', async () => {
  const f = setup({ error: { name: 'ForbiddenException', statusCode: 403 } });
  await assert.rejects(f.handler(), /Failed to deliver/);
  assert.deepEqual(f.deleted, []);
});
test('never sends stale data after a game change or upstream failure', async () => {
  const f = setup({ changed: true });
  assert.equal((await f.handler()).skipped, 'game_changed');
  assert.equal(f.sent.length, 0);
  const broken = setup({ fetchError: true });
  await assert.rejects(broken.handler(), /NHL down/);
  assert.equal(broken.sent.length, 0);
});
