const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const modulePath =
  process.env.HTTP_HANDLER_MODULE || '../../lambdas/http-api/handler.js';
const state = {
  draftStarted: true,
  pickOrder: [1, 2],
  currentPicker: 1,
  currentPickNumber: 1,
  availableTeams: ['BOS', 'TOR'],
  version: 7,
  isLocked: false,
  autoPickEnabled: true,
  autoPickSeconds: 30,
  autoPickDeadlineAt: '2030-01-01T00:00:30.000Z',
  pickHistory: [],
  updatedAt: '2030-01-01T00:00:00.000Z',
};
async function setup(overrides = {}, env = {}) {
  const calls = [];
  const defaults = {
    scan: () => ({ Items: [] }),
    query: () => ({ Items: [] }),
    get: (p) => ({
      Item:
        p.Key.id === 'draftState'
          ? { state }
          : { id: 1, name: 'Ryan', teams: [] },
    }),
    update: () => ({}),
    put: () => ({}),
    transactWrite: () => ({}),
  };
  const dynamoDB = Object.fromEntries(
    Object.keys(defaults).map((name) => [
      name,
      (params) => ({
        promise: async () => {
          calls.push({ name, params });
          return (overrides[name] || defaults[name])(params);
        },
      }),
    ])
  );
  const https = {
    get: (_url, callback) => {
      const request = new EventEmitter();
      request.setTimeout = () => {};
      queueMicrotask(() => {
        const response = new EventEmitter();
        callback(response);
        response.emit('data', JSON.stringify({ gameWeek: [] }));
        response.emit('end');
      });
      return request;
    },
  };
  const { createHttpHandler } = await import(modulePath);
  const handler = createHttpHandler({
    dynamoDB,
    https,
    env: { ADMIN_API_TOKEN: 'test-only', ...env },
  });
  const request = async (path, method = 'GET', body, query = {}) => {
    const result = await handler({
      rawPath: path,
      requestContext: { http: { method }, stage: 'test' },
      headers: { origin: 'http://localhost:8080' },
      queryStringParameters: query,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ...result, json: JSON.parse(result.body) };
  };
  return { handler, request, calls };
}
test('normalizes stage/trailing slash and preserves CORS/cache contract', async () => {
  const { request } = await setup({
    scan: () => ({ Items: [{ id: 1, name: 'Ryan' }] }),
  });
  const r = await request('/test/players/');
  assert.equal(r.statusCode, 200);
  assert.equal(r.json[0].name, 'Ryan');
  assert.equal(
    r.headers['Access-Control-Allow-Origin'],
    'http://localhost:8080'
  );
  assert.match(r.headers['Cache-Control'], /max-age=21600/);
  assert.equal(r.headers['Cache-Control'], r.headers['CDN-Cache-Control']);
});
test('invalid seasons/limits reject before database work', async () => {
  const { request, calls } = await setup();
  for (const season of ['garbage', '0', '-1'])
    assert.equal(
      (await request('/players', 'GET', undefined, { season })).statusCode,
      400
    );
  assert.equal(
    (await request('/champion/history', 'GET', undefined, { limit: '-1' }))
      .statusCode,
    400
  );
  assert.equal(calls.length, 0);
});
test('season selection resolves independent legacy read tables', async () => {
  const { request, calls } = await setup();
  await request('/players', 'GET', undefined, { season: '1' });
  await request('/game-records', 'GET', undefined, { season: 'season2' });
  assert.deepEqual(
    calls.map((c) => c.params.TableName),
    ['Players-Season1', 'GameRecords']
  );
});
test('admin mutations reject unauthenticated callers without writes', async () => {
  const { request, calls } = await setup();
  for (const [path, method] of [
    ['/draft/state', 'PATCH'],
    ['/draft/undo-last-pick', 'POST'],
    ['/players/reset-teams', 'POST'],
    ['/players/1/teams', 'PATCH'],
    ['/draft/select-team', 'POST'],
  ])
    assert.equal((await request(path, method, { version: 7 })).statusCode, 401);
  assert.equal(calls.length, 0);
});
test('pick rejects wrong turns, unavailable teams and stale versions', async () => {
  const { request, calls } = await setup();
  assert.equal(
    (
      await request('/draft/pick', 'POST', {
        playerId: 2,
        team: 'BOS',
        version: 7,
      })
    ).statusCode,
    400
  );
  assert.equal(
    (
      await request('/draft/pick', 'POST', {
        playerId: 1,
        team: 'XXX',
        version: 7,
      })
    ).statusCode,
    400
  );
  const r = await request('/draft/pick', 'POST', {
    playerId: 1,
    team: 'BOS',
    version: 6,
  });
  assert.equal(r.statusCode, 409);
  assert.equal(r.json.currentVersion, 7);
  assert.equal(calls.filter((c) => c.name === 'transactWrite').length, 0);
});
test('locked draft rejects a valid pick', async () => {
  const { request } = await setup({
    get: () => ({
      Item: { state: { ...state, isLocked: true, autoPickDeadlineAt: null } },
    }),
  });
  assert.equal(
    (
      await request('/draft/pick', 'POST', {
        playerId: 1,
        team: 'BOS',
        version: 7,
      })
    ).statusCode,
    400
  );
});
test('pick returns next turn/history and uses conditional atomic roster + state writes', async () => {
  const { request, calls } = await setup();
  const r = await request('/draft/pick', 'POST', {
    playerId: 1,
    team: 'bos',
    version: 7,
  });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json.state.version, 8);
  assert.equal(r.json.state.currentPicker, 2);
  assert.deepEqual(r.json.player.teams, ['BOS']);
  assert.equal(r.json.state.pickHistory.length, 1);
  const items = calls.find((c) => c.name === 'transactWrite').params
    .TransactItems;
  assert.equal(items.length, 2);
  assert.match(items[1].Update.ConditionExpression, /#version/);
});
test('transaction cancellation returns conflict with latest state', async () => {
  const { request } = await setup({
    transactWrite: () => {
      throw Object.assign(new Error('race'), {
        code: 'TransactionCanceledException',
      });
    },
  });
  const r = await request('/draft/pick', 'POST', {
    playerId: 1,
    team: 'BOS',
    version: 7,
  });
  assert.equal(r.statusCode, 409);
  assert.equal(r.json.currentState.version, 7);
});
test('preflight, metadata and missing route preserve response shapes', async () => {
  const { request } = await setup({}, { SEASON1_SEASON_OVER: 'true' });
  assert.equal((await request('/players', 'OPTIONS')).statusCode, 204);
  assert.equal(
    (await request('/season/meta', 'GET', undefined, { season: 'season1' }))
      .json.seasonOver,
    true
  );
  assert.equal((await request('/missing')).statusCode, 404);
});
test('storage errors produce a 500 response', async () => {
  const { request } = await setup({
    scan: () => {
      throw new Error('storage unavailable');
    },
  });
  assert.equal((await request('/players')).statusCode, 500);
});
