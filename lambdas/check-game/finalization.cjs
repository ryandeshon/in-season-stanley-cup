// Commit the game ledger, player counters and champion transition as one unit.
// Existing legacy records are never guessed/repaired here: reconcile them in rollover.
function createFinalization({
  dynamoDB,
  env,
  TABLE_NAME,
  PARTITION_KEY,
  PLAYERS_TABLE,
  GAME_RECORDS,
  CHAMPION_FIELD,
  CHECK_STATUS_FIELD,
  LAST_CHECKED_AT_FIELD,
  FINALIZED_AT_FIELD,
  PROCESSED_GAME_ID_FIELD,
  ACTIVE_GAME_ID_FIELD,
  GAME_ID_FIELD,
  NEXT_CHECK_AT_FIELD,
  WATCH_STARTED_AT_FIELD,
  findPlayerWithTeam,
  log,
}) {
  async function finalizeGame({
    gameID,
    expectedChampion,
    wTeam,
    wScore,
    lTeam,
    lScore,
  }) {
    const existing = async () =>
      (
        await dynamoDB
          .get({
            TableName: GAME_RECORDS,
            Key: { id: gameID },
            ConsistentRead: true,
          })
          .promise()
      ).Item;
    if (await existing()) return { applied: false };
    const playerId = await findPlayerWithTeam(wTeam);
    if (env?.SEASON_STORAGE === 'v2' && playerId == null)
      throw new Error('No season owner for winning team');
    const timestamp = new Date().toISOString();
    const TransactItems = [
      {
        Put: {
          TableName: GAME_RECORDS,
          Item: {
            id: gameID,
            wTeam,
            wScore,
            lTeam,
            lScore,
            savedAt: timestamp,
            statsApplied: true,
            defensePlayerId: playerId,
          },
          ConditionExpression: 'attribute_not_exists(id)',
        },
      },
      {
        Update: {
          TableName: TABLE_NAME,
          Key: { id: PARTITION_KEY },
          UpdateExpression:
            'SET #champion = :winner, #status = :finalized, #checked = :ts, #finalizedAt = :ts, #processed = :game, updatedAt = :ts REMOVE #active, #gid, #next, #watch',
          ConditionExpression:
            '#champion = :expected AND (attribute_not_exists(#active) OR #active = :game) AND (attribute_not_exists(#gid) OR #gid = :game)',
          ExpressionAttributeNames: {
            '#champion': CHAMPION_FIELD,
            '#status': CHECK_STATUS_FIELD,
            '#checked': LAST_CHECKED_AT_FIELD,
            '#finalizedAt': FINALIZED_AT_FIELD,
            '#processed': PROCESSED_GAME_ID_FIELD,
            '#active': ACTIVE_GAME_ID_FIELD,
            '#gid': GAME_ID_FIELD,
            '#next': NEXT_CHECK_AT_FIELD,
            '#watch': WATCH_STARTED_AT_FIELD,
          },
          ExpressionAttributeValues: {
            ':winner': wTeam,
            ':expected': expectedChampion,
            ':finalized': 'finalized',
            ':ts': timestamp,
            ':game': gameID,
          },
        },
      },
    ];
    if (playerId !== null && playerId !== undefined)
      TransactItems.push({
        Update: {
          TableName: PLAYERS_TABLE,
          Key: { id: playerId },
          UpdateExpression:
            'SET titleDefenses = if_not_exists(titleDefenses, :zero) + :inc, totalDefenses = if_not_exists(totalDefenses, :zero) + :inc',
          ConditionExpression:
            'attribute_exists(id) AND contains(teams, :team)',
          ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':team': wTeam },
        },
      });
    if (env?.SEASON_STORAGE === 'v2')
      TransactItems.push({
        Update: {
          TableName: env.PLAYER_LIFETIME_TABLE,
          Key: { id: String(playerId) },
          UpdateExpression: 'SET totalDefenses = totalDefenses + :one',
          ConditionExpression: 'attribute_exists(id)',
          ExpressionAttributeValues: { ':one': 1 },
        },
      });
    try {
      await dynamoDB.transactWrite({ TransactItems }).promise();
    } catch (error) {
      // A cancellation is a duplicate only if another transaction committed the ledger.
      // Permission/validation/transient errors and roster changes must remain failures.
      if (error.code === 'TransactionCanceledException' && (await existing()))
        return { applied: false };
      throw error;
    }
    log('info', 'Game, champion and defenses committed', { gameID, playerId });
    return { applied: true };
  }
  return { finalizeGame };
}
module.exports = { createFinalization };
