const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler } = require('../../lambdas/check-game/scheduler.cjs');
const {
  schedulerAtExpression,
} = require('../../lambdas/check-game/check-game-logic.cjs');
const base = {
  SELF_SCHEDULING_ENABLED: true,
  SCHEDULER_ROLE_ARN: 'test-role',
  SCHEDULER_GROUP_NAME: 'test-group',
  WATCH_SCHEDULE_NAME: 'test-watch',
  env: { CHECK_GAME_FUNCTION_ARN: 'test-function' },
  log: () => {},
  schedulerAtExpression,
};
test('existing schedule is updated with bounded retries and a stable target', async () => {
  let updated;
  const service = createScheduler({
    ...base,
    scheduler: {
      createSchedule: () => ({
        promise: async () => {
          throw Object.assign(new Error(), { code: 'ConflictException' });
        },
      }),
      updateSchedule: (p) => ({
        promise: async () => {
          updated = p;
        },
      }),
    },
  });
  await service.upsertSelfSchedule('2030-01-01T00:01:00.000Z', 123, 'live');
  assert.equal(updated.ScheduleExpression, 'at(2030-01-01T00:01:00)');
  assert.equal(updated.Target.RetryPolicy.MaximumRetryAttempts, 2);
  assert.equal(JSON.parse(updated.Target.Input).gameID, 123);
});
test('scheduler permission failures propagate instead of being treated as conflicts', async () => {
  const service = createScheduler({
    ...base,
    scheduler: {
      createSchedule: () => ({
        promise: async () => {
          throw new Error('denied');
        },
      }),
    },
  });
  await assert.rejects(
    service.upsertSelfSchedule('2030-01-01T00:01:00.000Z', 123, 'live'),
    /denied/
  );
});
test('cleanup tolerates a deleted schedule and invalidates only configured paths', async () => {
  let invalidation;
  const service = createScheduler({
    ...base,
    scheduler: {
      deleteSchedule: () => ({
        promise: async () => {
          throw Object.assign(new Error(), {
            code: 'ResourceNotFoundException',
          });
        },
      }),
    },
    API_CACHE_DISTRIBUTION_ID: 'test-distribution',
    API_CACHE_INVALIDATION_PATHS: ['/champion', '/gameid'],
    cloudFront: {
      createInvalidation: (p) => ({
        promise: async () => {
          invalidation = p;
          return {};
        },
      }),
    },
  });
  await service.clearSelfSchedule(123, 'finalized');
  await service.invalidateApiCache(123, 'finalized');
  assert.deepEqual(invalidation.InvalidationBatch.Paths.Items, [
    '/champion',
    '/gameid',
  ]);
});
