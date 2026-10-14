// Read-only game publisher. It never changes scores, ownership, or season state.
function createHandler({ db, post, getGame, env, log = console }) {
  return async () => {
    const { Item: catalog } = await db
      .get({
        TableName: env.SEASON_CATALOG_TABLE,
        Key: { id: 'catalog' },
        ConsistentRead: true,
      })
      .promise();
    const seasonId = catalog?.defaultSeason;
    if (!seasonId) throw new Error('Missing default season');
    const { Item: season } = await db
      .get({
        TableName: env.SEASON_CATALOG_TABLE,
        Key: { id: seasonId },
        ConsistentRead: true,
      })
      .promise();
    if (season?.status !== 'active') return { skipped: 'inactive_season' };
    const { Item: options } = await db
      .get({
        TableName: env.SEASON_OPTIONS_TABLE,
        Key: { seasonId, id: 'currentChampion' },
        ConsistentRead: true,
      })
      .promise();
    const gameId = options?.activeGameId || options?.gameID;
    if (!gameId) return { skipped: 'no_game' };
    const connections = [];
    let key;
    do {
      const page = await db
        .scan({
          TableName: env.SOCKET_CONNECTIONS_TABLE,
          ProjectionExpression: 'connectionId',
          ...(key ? { ExclusiveStartKey: key } : {}),
        })
        .promise();
      connections.push(...(page.Items || []));
      key = page.LastEvaluatedKey;
    } while (key);
    if (!connections.length) return { skipped: 'no_viewers' };
    const game = await getGame(gameId);
    if (
      String(game?.id) !== String(gameId) ||
      !game?.homeTeam ||
      !game?.awayTeam
    )
      throw new Error('Invalid game response');
    // A finalization/rollover may have happened during the fetch. Never push an old game over a new one.
    const { Item: current } = await db
      .get({
        TableName: env.SEASON_OPTIONS_TABLE,
        Key: { seasonId, id: 'currentChampion' },
        ConsistentRead: true,
      })
      .promise();
    if (String(current?.activeGameId || current?.gameID) !== String(gameId))
      return { skipped: 'game_changed' };
    const data = Buffer.from(
      JSON.stringify({ type: 'liveGameUpdate', seasonId, payload: game })
    );
    if (data.length > 32000)
      throw new Error('Game update exceeds WebSocket frame limit');
    let sent = 0,
      stale = 0,
      failed = 0;
    // Bound parallel sends; continue delivering to healthy clients if one connection fails.
    for (let i = 0; i < connections.length; i += 10) {
      await Promise.all(
        connections.slice(i, i + 10).map(async ({ connectionId }) => {
          try {
            await post(connectionId, data);
            sent++;
          } catch (error) {
            if (
              error.statusCode === 410 ||
              error.$metadata?.httpStatusCode === 410
            ) {
              await db
                .delete({
                  TableName: env.SOCKET_CONNECTIONS_TABLE,
                  Key: { connectionId },
                })
                .promise();
              stale++;
            } else {
              failed++;
              log.error('Broadcast delivery failed', {
                code: error.name || error.code,
              });
            }
          }
        })
      );
    }
    const result = { seasonId, gameId, sent, stale, failed };
    log.info('Live broadcast', result);
    if (failed) throw new Error(`Failed to deliver ${failed} live updates`);
    return result;
  };
}
module.exports = { createHandler };
