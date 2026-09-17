function createStateStore({
  ACTIVE_GAME_ID_FIELD,
  CHECK_STATUS,
  CHECK_STATUS_FIELD,
  FINALIZED_AT_FIELD,
  GAME_ID_FIELD,
  LAST_CHECKED_AT_FIELD,
  NEXT_CHECK_AT_FIELD,
  PARTITION_KEY,
  PLAYERS_TABLE,
  TABLE_NAME,
  WATCH_STARTED_AT_FIELD,
  dynamoDB,
  log,
}) {
  function nowIso() {
    return new Date().toISOString();
  }

  function getActiveGameId(gameOptions) {
    return (
      gameOptions?.[ACTIVE_GAME_ID_FIELD] ??
      gameOptions?.[GAME_ID_FIELD] ??
      null
    );
  }

  async function getGameOptions() {
    const params = {
      TableName: TABLE_NAME,
      Key: { id: PARTITION_KEY },
      ConsistentRead: true,
    };
    try {
      const result = await dynamoDB.get(params).promise();
      return result.Item || {};
    } catch (error) {
      log('error', 'DynamoDB get (GameOptions) failed', {
        error: String(error),
      });
      throw new Error('Failed to retrieve game options');
    }
  }

  async function updateWatchState(gameID, nextCheckAt, decision) {
    const timestamp = nowIso();
    const params = {
      TableName: TABLE_NAME,
      Key: { id: PARTITION_KEY },
      UpdateExpression:
        'SET #gid = :g, #activeGame = :g, #status = :watching, #watchStartedAt = if_not_exists(#watchStartedAt, :checked), #lastCheckedAt = :checked, #nextCheckAt = :nextCheck, updatedAt = :ts REMOVE #finalizedAt',
      ExpressionAttributeNames: {
        '#gid': GAME_ID_FIELD,
        '#activeGame': ACTIVE_GAME_ID_FIELD,
        '#status': CHECK_STATUS_FIELD,
        '#watchStartedAt': WATCH_STARTED_AT_FIELD,
        '#lastCheckedAt': LAST_CHECKED_AT_FIELD,
        '#nextCheckAt': NEXT_CHECK_AT_FIELD,
        '#finalizedAt': FINALIZED_AT_FIELD,
      },
      ExpressionAttributeValues: {
        ':g': gameID,
        ':watching': CHECK_STATUS.WATCHING,
        ':checked': timestamp,
        ':nextCheck': nextCheckAt,
        ':ts': timestamp,
      },
      ReturnValues: 'UPDATED_NEW',
    };
    const out = await dynamoDB.update(params).promise();
    log('info', 'Watch state updated', {
      gameID,
      decision,
      nextCheckAt,
      updated: out?.Attributes,
    });
  }

  async function setIdleState(decision) {
    const timestamp = nowIso();
    const params = {
      TableName: TABLE_NAME,
      Key: { id: PARTITION_KEY },
      UpdateExpression:
        'SET #status = :idle, #lastCheckedAt = :checked, updatedAt = :ts REMOVE #activeGame, #gid, #nextCheckAt, #watchStartedAt',
      ExpressionAttributeNames: {
        '#status': CHECK_STATUS_FIELD,
        '#lastCheckedAt': LAST_CHECKED_AT_FIELD,
        '#activeGame': ACTIVE_GAME_ID_FIELD,
        '#gid': GAME_ID_FIELD,
        '#nextCheckAt': NEXT_CHECK_AT_FIELD,
        '#watchStartedAt': WATCH_STARTED_AT_FIELD,
      },
      ExpressionAttributeValues: {
        ':idle': CHECK_STATUS.IDLE,
        ':checked': timestamp,
        ':ts': timestamp,
      },
      ReturnValues: 'UPDATED_NEW',
    };

    const out = await dynamoDB.update(params).promise();
    log('info', 'Set checker to idle', { decision, updated: out?.Attributes });
  }

  async function findPlayerWithTeam(team) {
    const params = { TableName: PLAYERS_TABLE };
    try {
      const result = await dynamoDB.scan(params).promise();
      const player = result.Items?.find(
        (p) => Array.isArray(p.teams) && p.teams.includes(team)
      );
      return player ? player.id : null;
    } catch (error) {
      log('error', 'Players scan failed', { error: String(error) });
      throw new Error('Failed to find player with winning team');
    }
  }

  function isWatchTooLong(gameOptions, maxMs = 8 * 60 * 60 * 1000) {
    const startedAt = gameOptions?.[WATCH_STARTED_AT_FIELD];
    if (!startedAt) return false;
    const parsed = Date.parse(startedAt);
    if (!Number.isFinite(parsed)) return false;
    return Date.now() - parsed > maxMs;
  }
  return {
    nowIso,
    getActiveGameId,
    getGameOptions,
    updateWatchState,
    setIdleState,
    findPlayerWithTeam,
    isWatchTooLong,
  };
}
module.exports = { createStateStore };
