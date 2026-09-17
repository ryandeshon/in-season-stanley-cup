const { collect } = require('./season-storage.cjs');
async function get(db, table, key) {
  return (
    await db.get({ TableName: table, Key: key, ConsistentRead: true }).promise()
  ).Item;
}
async function transition(
  db,
  tables,
  id,
  expectedRevision,
  { status, champion, regularSeasonEnd, playoffsStart } = {}
) {
  const season = await get(db, tables.catalog, { id });
  if (
    status === 'archived' &&
    season?.status === 'archived' &&
    season.championshipAwarded
  )
    return { applied: false, season };
  if (!season || season.revision !== expectedRevision)
    throw new Error('Season revision conflict');
  const players = await collect(db, 'query', {
    TableName: tables.players,
    KeyConditionExpression: 'seasonId = :s',
    ExpressionAttributeValues: { ':s': id },
    ConsistentRead: true,
  });
  const options = await get(db, tables.options, {
    seasonId: id,
    id: 'currentChampion',
  });
  const draft = await get(db, tables.options, {
    seasonId: id,
    id: 'draftState',
  });
  const items = [];
  let next;
  if (
    status === 'preseason' &&
    season.status === 'preseason' &&
    !season.writersEnabled
  ) {
    next = { ...season, writersEnabled: true };
  } else if (status === 'active' && season.status === 'preseason') {
    if (
      !champion ||
      players.length !== 4 ||
      players.some((p) => p.teams?.length !== 8) ||
      new Set(players.flatMap((p) => p.teams)).size !== 32 ||
      draft?.state?.availableTeams?.length !== 0
    )
      throw new Error('Complete the draft before activation');
    if (!players.some((p) => p.teams.includes(champion)))
      throw new Error('Starting champion has no owner');
    if (
      ![regularSeasonEnd, playoffsStart].every(
        (d) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d || '') && Number.isFinite(Date.parse(d))
      ) ||
      playoffsStart <= regularSeasonEnd
    )
      throw new Error('Explicit season dates required');
    next = {
      ...season,
      status: 'active',
      writersEnabled: true,
      regularSeasonEnd,
      playoffsStart,
    };
    items.push({
      Update: {
        TableName: tables.options,
        Key: { seasonId: id, id: 'currentChampion' },
        UpdateExpression: 'SET champion = :c, checkStatus = :s',
        ExpressionAttributeValues: { ':c': champion, ':s': 'idle' },
      },
    });
    items.push({
      ConditionCheck: {
        TableName: tables.options,
        Key: { seasonId: id, id: 'draftState' },
        ConditionExpression: '#state.#version = :v',
        ExpressionAttributeNames: { '#state': 'state', '#version': 'version' },
        ExpressionAttributeValues: { ':v': draft.state.version },
      },
    });
  } else if (status === 'archived' && season.status === 'active') {
    if (
      !players.length ||
      !options?.champion ||
      options.activeGameId ||
      options.gameID ||
      !options.processedGameId
    )
      throw new Error('Finish the final game before closeout');
    const max = Math.max(...players.map((p) => p.titleDefenses));
    const contenders = players.filter((p) => p.titleDefenses === max);
    const winner =
      contenders.find((p) => p.teams.includes(options.champion)) ||
      contenders.sort((a, b) => a.name.localeCompare(b.name))[0];
    next = {
      ...season,
      status: 'archived',
      writersEnabled: false,
      championPlayerId: winner.id,
      championshipAwarded: true,
    };
    for (const [table, key] of [
      [tables.players, { seasonId: id, id: winner.id }],
      [tables.lifetime, { id: winner.id }],
    ])
      items.push({
        Update: {
          TableName: table,
          Key: key,
          UpdateExpression:
            'SET championships = championships + :one, lastChampionshipAwardSeason = :s',
          ConditionExpression: 'attribute_exists(id)',
          ExpressionAttributeValues: { ':one': 1, ':s': id },
        },
      });
    // Pin the last processed game so a simultaneous finalization forces a fresh closeout.
    items.push({
      ConditionCheck: {
        TableName: tables.options,
        Key: { seasonId: id, id: 'currentChampion' },
        ConditionExpression:
          'processedGameId = :g AND attribute_not_exists(activeGameId) AND attribute_not_exists(gameID)',
        ExpressionAttributeValues: { ':g': options.processedGameId },
      },
    });
  } else if (
    status === 'archived' &&
    season.status === 'archived' &&
    season.championshipAwarded
  )
    return { applied: false, season };
  else throw new Error('Invalid season transition');
  next.revision = season.revision + 1;
  // Guards every roster/counter used to make the transition decision.
  for (const p of players) {
    const update = items.find(
      (i) => i.Update?.TableName === tables.players && i.Update.Key.id === p.id
    );
    if (update) {
      update.Update.ConditionExpression +=
        ' AND titleDefenses = :d AND teams = :t';
      Object.assign(update.Update.ExpressionAttributeValues, {
        ':d': p.titleDefenses,
        ':t': p.teams,
      });
    } else
      items.push({
        ConditionCheck: {
          TableName: tables.players,
          Key: { seasonId: id, id: p.id },
          ConditionExpression: 'titleDefenses = :d AND teams = :t',
          ExpressionAttributeValues: { ':d': p.titleDefenses, ':t': p.teams },
        },
      });
  }
  items.push({
    Put: {
      TableName: tables.catalog,
      Item: next,
      ConditionExpression: 'revision = :r AND #status = :s',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':r': expectedRevision,
        ':s': season.status,
      },
    },
  });
  await db.transactWrite({ TransactItems: items }).promise();
  return { applied: true, season: next };
}
module.exports = { transition };
