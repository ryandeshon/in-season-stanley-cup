const { test } = require('node:test');
const assert = require('node:assert/strict');
async function setup(existing) {
  const [
    { createDraftService },
    { createDraftRules },
    { createConfig },
    errors,
  ] = await Promise.all([
    import('../../lambdas/http-api/draft-service.js'),
    import('../../lambdas/http-api/draft-rules.js'),
    import('../../lambdas/http-api/config.js'),
    import('../../lambdas/http-api/errors.js'),
  ]);
  const config = createConfig({});
  let state = existing;
  const players = [
    { id: '0', name: 'Ryan' },
    { id: '1', name: 'Cooper' },
    { id: '2', name: 'Terry' },
    { id: '3', name: 'Boz' },
  ];
  const write = (p) => {
    state = p.ExpressionAttributeValues[':state'];
    return {};
  };
  const dynamoDB = {
    get: () => ({
      promise: async () => ({ Item: state ? { state } : undefined }),
    }),
    update: (p) => ({ promise: async () => write(p) }),
    transactWrite: (p) => ({
      promise: async () => write(p.TransactItems.at(-1).Update),
    }),
  };
  return createDraftService({
    ...config,
    ...createDraftRules(config),
    ...errors,
    dynamoDB,
    listPlayers: async () => players,
    lockedDraftOrderNames: ['Terry', 'Boz', 'Cooper', 'Ryan'],
  });
}
test('locks first pick to standings and rejects reordered starts', async () => {
  const service = await setup();
  const state = await service.ensureDraftState();
  assert.deepEqual(state.pickOrder, [2, 3, 1, 0]);
  assert.equal(state.pickOrderLocked, true);
  await assert.rejects(
    service.updateDraftState({
      version: 0,
      draftStarted: true,
      pickOrder: [0, 1, 2, 3],
    }),
    /locked/
  );
  await assert.rejects(
    service.updateDraftState({
      version: 0,
      draftStarted: true,
      currentPicker: 0,
    }),
    /first pick/
  );
  const started = await service.updateDraftState({
    version: 0,
    draftStarted: true,
  });
  assert.equal(started.currentPicker, 2);
  assert.equal(started.currentPickNumber, 1);
  await assert.rejects(
    service.updateDraftState({ version: 1, pickOrder: [3, 2, 1, 0] }),
    /locked/
  );
  await assert.rejects(
    service.updateDraftState({ version: 1, currentPicker: 3 }),
    /pick or undo/
  );
});
test('reset retains the fixed order and starts again with the same player', async () => {
  const service = await setup();
  await service.updateDraftState({ version: 0, draftStarted: true });
  const reset = await service.resetDraft({
    version: 1,
    playersTable: 'Players',
  });
  assert.deepEqual(reset.state.pickOrder, [2, 3, 1, 0]);
  assert.equal(reset.state.draftStarted, false);
  const started = await service.updateDraftState({
    version: 2,
    draftStarted: true,
  });
  assert.equal(started.currentPicker, 2);
});
test('preserves in-progress practice picks until an explicit reset', async () => {
  const service = await setup({
    draftStarted: true,
    version: 7,
    pickOrder: [0, 1, 2, 3],
    currentPicker: 1,
    currentPickNumber: 6,
    pickHistory: [{ playerId: 0, team: 'BOS', pickNumber: 1 }],
  });
  const state = await service.ensureDraftState();
  assert.deepEqual(state.pickOrder, [0, 1, 2, 3]);
  assert.equal(state.draftOrderPendingReset, true);
  assert.equal(state.pickHistory.length, 1);
  const reset = await service.resetDraft({
    version: 7,
    playersTable: 'Players',
  });
  assert.deepEqual(reset.state.pickOrder, [2, 3, 1, 0]);
  assert.equal(reset.state.draftOrderPendingReset, false);
});
