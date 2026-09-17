function createScheduler({
  API_CACHE_DISTRIBUTION_ID,
  API_CACHE_INVALIDATION_PATHS,
  SCHEDULER_GROUP_NAME,
  SCHEDULER_ROLE_ARN,
  SELF_SCHEDULING_ENABLED,
  WATCH_SCHEDULE_NAME,
  cloudFront,
  env,
  log,
  scheduler,
  schedulerAtExpression,
}) {
  function getTargetArn(context) {
    return (
      env.CHECK_GAME_FUNCTION_ARN ||
      context?.invokedFunctionArn ||
      env.AWS_LAMBDA_FUNCTION_NAME
    );
  }

  async function upsertSelfSchedule(nextCheckAt, gameID, reason, context) {
    const targetArn = getTargetArn(context);
    if (!SELF_SCHEDULING_ENABLED) {
      log('info', 'Self scheduling disabled; skipping schedule update', {
        gameID,
        reason,
        decision: 'schedule_skipped_disabled',
        nextCheckAt,
      });
      return;
    }
    if (!scheduler) {
      log('info', 'AWS Scheduler SDK unavailable; skipping schedule update', {
        gameID,
        reason,
        decision: 'schedule_skipped_no_sdk',
        nextCheckAt,
      });
      return;
    }
    if (!SCHEDULER_ROLE_ARN || !targetArn) {
      log(
        'info',
        'Scheduler role/function ARN missing; skipping schedule update',
        {
          gameID,
          reason,
          decision: 'schedule_skipped_missing_config',
          nextCheckAt,
        }
      );
      return;
    }

    const baseParams = {
      Name: WATCH_SCHEDULE_NAME,
      GroupName: SCHEDULER_GROUP_NAME,
      ScheduleExpression: schedulerAtExpression(nextCheckAt),
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: targetArn,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({
          source: 'inseason.self-schedule',
          ...(env.CHECK_SEASON ? { seasonId: env.CHECK_SEASON } : {}),
          reason,
          gameID,
          nextCheckAt,
        }),
        RetryPolicy: {
          MaximumEventAgeInSeconds: 3600,
          MaximumRetryAttempts: 2,
        },
      },
    };

    try {
      await scheduler.createSchedule(baseParams).promise();
      log('info', 'Created self schedule', {
        gameID,
        reason,
        nextCheckAt,
        scheduleName: WATCH_SCHEDULE_NAME,
        decision: 'schedule_created',
      });
    } catch (error) {
      if (error?.code !== 'ConflictException') throw error;
      await scheduler.updateSchedule(baseParams).promise();
      log('info', 'Updated self schedule', {
        gameID,
        reason,
        nextCheckAt,
        scheduleName: WATCH_SCHEDULE_NAME,
        decision: 'schedule_updated',
      });
    }
  }

  async function clearSelfSchedule(gameID, reason) {
    if (!SELF_SCHEDULING_ENABLED || !scheduler) return;

    try {
      await scheduler
        .deleteSchedule({
          Name: WATCH_SCHEDULE_NAME,
          GroupName: SCHEDULER_GROUP_NAME,
        })
        .promise();
      log('info', 'Deleted self schedule', {
        gameID,
        reason,
        scheduleName: WATCH_SCHEDULE_NAME,
        decision: 'schedule_deleted',
      });
    } catch (error) {
      if (error?.code === 'ResourceNotFoundException') return;
      log('error', 'Failed to delete self schedule', {
        gameID,
        reason,
        error: String(error),
      });
    }
  }

  async function invalidateApiCache(gameID, reason) {
    if (!API_CACHE_DISTRIBUTION_ID) {
      log(
        'info',
        'API cache distribution not configured; skipping invalidation',
        {
          gameID,
          reason,
          decision: 'cache_invalidation_skipped_missing_distribution',
        }
      );
      return;
    }

    const paths = API_CACHE_INVALIDATION_PATHS.length
      ? API_CACHE_INVALIDATION_PATHS
      : ['/champion', '/gameid'];

    const callerReference = `check-game-${gameID}-${Date.now()}`;
    const params = {
      DistributionId: API_CACHE_DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: callerReference,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    };

    try {
      const result = await cloudFront.createInvalidation(params).promise();
      log('info', 'Requested API cache invalidation', {
        gameID,
        reason,
        distributionId: API_CACHE_DISTRIBUTION_ID,
        paths,
        invalidationId: result?.Invalidation?.Id,
        status: result?.Invalidation?.Status,
        decision: 'cache_invalidation_requested',
      });
    } catch (error) {
      log('error', 'Failed API cache invalidation request', {
        gameID,
        reason,
        distributionId: API_CACHE_DISTRIBUTION_ID,
        paths,
        error: String(error),
      });
    }
  }
  return {
    getTargetArn,
    upsertSelfSchedule,
    clearSelfSchedule,
    invalidateApiCache,
  };
}
module.exports = { createScheduler };
