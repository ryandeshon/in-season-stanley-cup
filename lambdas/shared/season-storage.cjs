// Canonical tables are opt-in. Legacy tables stay intact until an explicit cutover.
const TYPES = {
  players: 'SEASON_PLAYERS_TABLE',
  records: 'SEASON_RECORDS_TABLE',
  options: 'SEASON_OPTIONS_TABLE',
  lifetime: 'PLAYER_LIFETIME_TABLE',
  catalog: 'SEASON_CATALOG_TABLE',
};
async function collect(db, operation, params) {
  const items = [];
  let key;
  do {
    const result = await db[operation]({
      ...params,
      ...(key ? { ExclusiveStartKey: key } : {}),
    }).promise();
    items.push(...(result.Items || []));
    key = result.LastEvaluatedKey;
  } while (key);
  return items;
}
function config(env) {
  const tables = {};
  for (const [kind, variable] of Object.entries(TYPES)) {
    if (!env[variable])
      throw new Error(`Missing ${variable} for season storage`);
    tables[kind] = env[variable];
  }
  if (new Set(Object.values(tables)).size !== Object.keys(tables).length)
    throw new Error('Season tables must be distinct');
  return tables;
}
async function loadCatalog(db, env) {
  const tables = config(env);
  const rows = await collect(db, 'scan', {
    TableName: tables.catalog,
    ConsistentRead: true,
  });
  const settings = rows.find((row) => row.id === 'catalog');
  const seasons = rows.filter((row) => /^season[1-9]\d*$/.test(row.id));
  const defaultSeason = settings?.defaultSeason;
  if (!seasons.some((row) => row.id === defaultSeason))
    throw new Error('Invalid or missing season catalog default');
  return { tables, defaultSeason, seasons };
}
function seasonCondition(tables, season, allowedStatus) {
  return {
    ConditionCheck: {
      TableName: tables.catalog,
      Key: { id: season.id },
      ConditionExpression:
        '#status = :status AND revision = :revision AND writersEnabled = :enabled',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': allowedStatus,
        ':revision': season.revision,
        ':enabled': true,
      },
    },
  };
}
function scopedClient(db, tables, season, allowedStatus) {
  const kindFor = (table) =>
    Object.keys(tables).find((kind) => tables[kind] === table);
  const scope = (params) => {
    const kind = kindFor(params.TableName);
    if (!['players', 'records', 'options'].includes(kind)) return params;
    const withKey = (key) => ({
      ...key,
      id: kind === 'records' ? Number(key.id) : String(key.id),
      seasonId: season.id,
    });
    return {
      ...params,
      ...(params.Key ? { Key: withKey(params.Key) } : {}),
      ...(params.Item ? { Item: withKey(params.Item) } : {}),
    };
  };
  const guard = () => {
    if (season.status !== allowedStatus || season.writersEnabled !== true)
      throw Object.assign(new Error('Season writes are disabled'), {
        code: 'SeasonWriteLocked',
      });
  };
  const transactWrite = (params) => ({
    promise: async () => {
      guard();
      const items = params.TransactItems.map((item) =>
        Object.fromEntries(
          Object.entries(item).map(([action, value]) => [action, scope(value)])
        )
      );
      return db
        .transactWrite({
          ...params,
          TransactItems: [
            ...items,
            seasonCondition(tables, season, allowedStatus),
          ],
        })
        .promise();
    },
  });
  return {
    get: (p) => db.get(scope(p)),
    scan: (p) => {
      if (!['players', 'records', 'options'].includes(kindFor(p.TableName)))
        throw new Error('Unscoped scan forbidden');
      return db.query({
        ...p,
        KeyConditionExpression: '#season = :season',
        ExpressionAttributeNames: {
          ...p.ExpressionAttributeNames,
          '#season': 'seasonId',
        },
        ExpressionAttributeValues: {
          ...p.ExpressionAttributeValues,
          ':season': season.id,
        },
      });
    },
    transactWrite,
    update: (p) => ({
      promise: async () => {
        await transactWrite({
          TransactItems: [
            {
              Update: Object.fromEntries(
                Object.entries(p).filter(([k]) => k !== 'ReturnValues')
              ),
            },
          ],
        }).promise();
        return {
          Attributes: (
            await db
              .get({
                TableName: p.TableName,
                Key: scope(p).Key,
                ConsistentRead: true,
              })
              .promise()
          ).Item,
        };
      },
    }),
    put: (p) => transactWrite({ TransactItems: [{ Put: p }] }),
  };
}
module.exports = {
  collect,
  config,
  loadCatalog,
  scopedClient,
  seasonCondition,
};
