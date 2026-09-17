const { createHash } = require('node:crypto');
const { collect } = require('../../lambdas/shared/season-storage.cjs');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])])
    );
  return value;
}
const hash = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}
const definitions = {
  lifetime: [['id', 'S']],
  catalog: [['id', 'S']],
  players: [
    ['seasonId', 'S'],
    ['id', 'S'],
  ],
  records: [
    ['seasonId', 'S'],
    ['id', 'N'],
  ],
  options: [
    ['seasonId', 'S'],
    ['id', 'S'],
  ],
};
function schema(TableName, kind) {
  return {
    TableName,
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: definitions[kind].map(([AttributeName], i) => ({
      AttributeName,
      KeyType: i ? 'RANGE' : 'HASH',
    })),
    AttributeDefinitions: definitions[kind].map(
      ([AttributeName, AttributeType]) => ({ AttributeName, AttributeType })
    ),
  };
}
function planMigration(source, { acceptStoredTotals = false } = {}) {
  const current = source.Players;
  requireValue(
    Array.isArray(current) && current.length === 4,
    'Expected four current players'
  );
  const ids = new Set(current.map((p) => p.id));
  requireValue(
    ids.size === 4 && current.every((p) => typeof p.id === 'string' && p.name),
    'Unique string player identities required'
  );
  const rows = Object.fromEntries(Object.keys(definitions).map((k) => [k, []]));
  const anomalies = [];
  const snapshots = [source['Players-Season1'], current];
  for (const [index, snapshot] of snapshots.entries()) {
    const seasonId = `season${index + 1}`;
    requireValue(
      snapshot?.length === current.length &&
        new Set(snapshot.map((p) => p.id)).size === ids.size,
      `Player set mismatch: ${seasonId}`
    );
    const players = snapshot.map((p) => {
      requireValue(
        ids.has(p.id) && current.find((c) => c.id === p.id)?.name === p.name,
        `Identity mismatch: ${seasonId}`
      );
      let teams = p.teams;
      if (index === 1 && !Array.isArray(teams)) {
        const draft = source.PlayersDraft?.find((r) => r.id === p.id);
        const restore = source['Players-restore-20260314']?.find(
          (r) => r.id === p.id
        );
        requireValue(
          draft?.name === p.name &&
            restore?.name === p.name &&
            Array.isArray(draft.teams) &&
            hash([...draft.teams].sort()) ===
              hash([...(restore.teams || [])].sort()),
          'Independent roster recovery sources must agree'
        );
        teams = [...draft.teams];
      }
      requireValue(
        Array.isArray(teams) && teams.length === 8,
        `Incomplete archived roster: ${p.name}`
      );
      requireValue(
        Number.isInteger(p.titleDefenses) && p.titleDefenses >= 0,
        'Invalid seasonal counter'
      );
      return { ...p, seasonId, teams };
    });
    requireValue(
      new Set(players.flatMap((p) => p.teams)).size === 32,
      `Duplicate teams: ${seasonId}`
    );
    const games = source[index ? 'GameRecords' : 'GameRecords-Season1'];
    const prefix = index ? '202502' : '202402';
    requireValue(
      Array.isArray(games) &&
        games.length > 0 &&
        new Set(games.map((g) => g.id)).size === games.length,
      'Missing/duplicate games'
    );
    requireValue(
      games.every(
        (g) =>
          Number.isInteger(g.id) &&
          String(g.id).startsWith(prefix) &&
          players.some((p) => p.teams.includes(g.wTeam))
      ),
      'Invalid game season or owner'
    );
    for (const p of players) {
      const wins = games.filter((g) => p.teams.includes(g.wTeam)).length;
      if (wins !== p.titleDefenses)
        anomalies.push({
          playerId: p.id,
          seasonId,
          kind: 'seasonal-counter',
          stored: p.titleDefenses,
          recorded: wins,
        });
    }
    rows.players.push(...players);
    rows.records.push(...games.map((g) => ({ ...g, seasonId })));
    const latest = [...games].sort((a, b) => b.id - a.id)[0];
    const option = index
      ? source.GameOptions?.find((o) => o.id === 'currentChampion')
      : null;
    if (option)
      requireValue(
        option.champion === latest.wTeam &&
          (!option.processedGameId || option.processedGameId === latest.id) &&
          !option.activeGameId &&
          !option.gameID,
        'Champion/ledger mismatch or active game; quiesce and reconcile source'
      );
    rows.options.push({
      ...(option || {
        id: 'currentChampion',
        champion: latest.wTeam,
        processedGameId: latest.id,
      }),
      seasonId,
    });
    const rawDraft = index
      ? source.GameOptions?.find((o) => o.id === 'draftState')
      : null;
    rows.options.push({
      ...(rawDraft || {
        id: 'draftState',
        state: {
          version: 0,
          draftStarted: false,
          isLocked: true,
          availableTeams: [],
          pickHistory: [],
        },
      }),
      seasonId,
      historyAvailability: 'legacy-history-unavailable',
    });
    rows.catalog.push({
      id: seasonId,
      label: `Season ${index + 1}`,
      status: 'archived',
      revision: 1,
      writersEnabled: false,
      nhlGamePrefix: prefix,
      historyAvailability: 'legacy-history-unavailable',
    });
  }
  for (const p of current) {
    requireValue(
      ['totalDefenses', 'championships'].every(
        (k) => Number.isInteger(p[k]) && p[k] >= 0
      ),
      'Invalid lifetime baseline'
    );
    const seasonalSum = rows.players
      .filter((s) => s.id === p.id)
      .reduce((sum, s) => sum + s.titleDefenses, 0);
    if (seasonalSum !== p.totalDefenses)
      anomalies.push({
        playerId: p.id,
        kind: 'lifetime-counter',
        stored: p.totalDefenses,
        seasonalSum,
      });
    rows.lifetime.push({
      id: p.id,
      name: p.name,
      totalDefenses: p.totalDefenses,
      championships: p.championships,
      ...(p.lastChampionshipAwardSeason
        ? { lastChampionshipAwardSeason: p.lastChampionshipAwardSeason }
        : {}),
    });
    rows.players.push({
      id: p.id,
      name: p.name,
      seasonId: 'season3',
      totalDefenses: p.totalDefenses,
      championships: p.championships,
      titleDefenses: 0,
      teams: [],
    });
  }
  requireValue(
    !anomalies.length || acceptStoredTotals,
    'Counter discrepancies require explicit acceptStoredTotals baseline acknowledgment'
  );
  rows.catalog.push(
    {
      id: 'season3',
      label: 'Season 3',
      status: 'preseason',
      revision: 1,
      writersEnabled: false,
      nhlGamePrefix: '202602',
      regularSeasonEnd: null,
      playoffsStart: null,
    },
    { id: 'catalog', defaultSeason: 'season3' }
  );
  const teams = [
    ...new Set(
      rows.players
        .filter((p) => p.seasonId === 'season2')
        .flatMap((p) => p.teams)
    ),
  ].sort();
  rows.options.push(
    {
      id: 'currentChampion',
      seasonId: 'season3',
      champion: null,
      checkStatus: 'preseason',
    },
    {
      id: 'draftState',
      seasonId: 'season3',
      state: {
        version: 0,
        draftStarted: false,
        currentPicker: null,
        pickOrder: [],
        currentPickNumber: 1,
        availableTeams: teams,
        pickHistory: [],
        isLocked: false,
        autoPickEnabled: false,
        autoPickSeconds: 60,
        autoPickDeadlineAt: null,
      },
    }
  );
  rows.catalog.push({
    id: 'migration',
    sourceHash: hash(source),
    baseline: 'stored-current-player-totals',
    anomalies,
    legacyDraftSource: source.DraftState || [],
    rosterRecoverySources: ['PlayersDraft', 'Players-restore-20260314'],
  });
  return {
    version: 1,
    sourceHash: hash(source),
    targetHash: hash(rows),
    rows,
    anomalies,
    baseline: 'stored-current-player-totals',
    sourceCounts: Object.fromEntries(
      Object.entries(source).map(([k, v]) => [k, v.length])
    ),
  };
}
async function preflight(db, tables) {
  requireValue(
    new Set(Object.values(tables)).size === Object.keys(definitions).length,
    'Distinct target tables required'
  );
  for (const kind of Object.keys(definitions)) {
    requireValue(tables[kind], `Missing target: ${kind}`);
    const { Table } = await db
      .describeTable({ TableName: tables[kind] })
      .promise();
    const expected = schema(tables[kind], kind);
    requireValue(
      hash(Table.KeySchema) === hash(expected.KeySchema) &&
        definitions[kind].every(([k, t]) =>
          Table.AttributeDefinitions.some(
            (a) => a.AttributeName === k && a.AttributeType === t
          )
        ),
      `Schema mismatch: ${kind}`
    );
  }
}
const keyFor = (kind, row) =>
  Object.fromEntries(definitions[kind].map(([key]) => [key, row[key]]));
async function applyMigration(db, tables, plan, { apply = false } = {}) {
  requireValue(
    plan.version === 1 && plan.targetHash === hash(plan.rows),
    'Manifest fingerprint mismatch'
  );
  await preflight(db, tables);
  const pending = [];
  // Preflight ALL content before the first write, including unexpected rows.
  for (const kind of Object.keys(definitions)) {
    const existing = await collect(db, 'scan', {
      TableName: tables[kind],
      ConsistentRead: true,
    });
    const expected = new Map(
      plan.rows[kind].map((row) => [hash(keyFor(kind, row)), row])
    );
    for (const row of existing) {
      const wanted = expected.get(hash(keyFor(kind, row)));
      requireValue(
        wanted && hash(wanted) === hash(row),
        `Target content differs: ${kind}; refusing overwrite`
      );
    }
    const present = new Set(existing.map((row) => hash(keyFor(kind, row))));
    for (const row of plan.rows[kind])
      if (!present.has(hash(keyFor(kind, row)))) pending.push({ kind, row });
  }
  if (apply)
    for (const { kind, row } of pending)
      await db
        .put({
          TableName: tables[kind],
          Item: row,
          ConditionExpression: 'attribute_not_exists(id)',
        })
        .promise();
  return {
    applied: apply,
    pending: pending.length,
    targetHash: plan.targetHash,
  };
}
module.exports = {
  planMigration,
  applyMigration,
  preflight,
  hash,
  schema,
  definitions,
  keyFor,
};
