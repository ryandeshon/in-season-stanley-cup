const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  waitUntilTableExists,
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { createChecker } = require('../../lambdas/check-game/handler.cjs');
const realAws = process.env.DYNAMODB_TEST_AWS === 'true';
const endpoint = process.env.DYNAMODB_TEST_ENDPOINT || 'http://localhost:8000';
if (
  !realAws &&
  !['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname)
)
  throw new Error(
    'Only a local endpoint is allowed without explicit AWS opt-in'
  );
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  maxAttempts: 3,
  ...(realAws
    ? {}
    : {
        endpoint,
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      }),
});
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
const prefix = `isc-phase2-test-${randomUUID().slice(0, 8)}-`;
const tables = Object.fromEntries(
  ['players', 'archive', 'records', 'options'].map((name) => [
    name,
    prefix + name,
  ])
);
const created = [];
const commandTypes = {
  get: GetCommand,
  put: PutCommand,
  update: UpdateCommand,
  scan: ScanCommand,
  query: QueryCommand,
  transactWrite: TransactWriteCommand,
};
const db = Object.fromEntries(
  Object.entries(commandTypes).map(([name, Command]) => [
    name,
    (params) => ({
      promise: async () => {
        const targets = params.TransactItems?.map(
          (item) => Object.values(item)[0].TableName
        ) || [params.TableName];
        assert.ok(
          targets.every((table) => table.startsWith(prefix)),
          'Every operation must target this run’s disposable tables'
        );
        try {
          return await doc.send(new Command(params));
        } catch (error) {
          error.code = error.name;
          throw error;
        }
      },
    }),
  ])
);
const env = {
  PLAYERS_TABLE: tables.players,
  PLAYERS_TABLE_SEASON1: tables.archive,
  GAME_RECORDS_TABLE: tables.records,
  GAME_OPTIONS_TABLE: tables.options,
  SELF_SCHEDULING_ENABLED: 'false',
  ADMIN_API_TOKEN: 'test-only',
};
const draft = {
  draftStarted: true,
  pickOrder: [1, 2],
  currentPicker: 1,
  currentPickNumber: 1,
  availableTeams: ['BOS', 'TOR'],
  version: 7,
  isLocked: false,
  autoPickEnabled: false,
  autoPickSeconds: 60,
  autoPickDeadlineAt: null,
  pickHistory: [],
  updatedAt: new Date().toISOString(),
};
let api;
before(async () => {
  for (const [name, TableName] of Object.entries(tables)) {
    const numeric = name !== 'options';
    await client.send(
      new CreateTableCommand({
        TableName,
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: numeric ? 'N' : 'S' },
        ],
      })
    );
    created.push(TableName);
  }
  await Promise.all(
    created.map((TableName) =>
      waitUntilTableExists(
        { client, minDelay: 1, maxWaitTime: 90 },
        { TableName }
      )
    )
  );
  const { createHttpHandler } =
    await import('../../lambdas/http-api/handler.js');
  api = createHttpHandler({ dynamoDB: db, env, https: null });
});
after(async () => {
  try {
    await Promise.all(
      created.map((TableName) =>
        client.send(new DeleteTableCommand({ TableName }))
      )
    );
  } finally {
    client.destroy();
  }
});
beforeEach(async () => {
  await db
    .put({
      TableName: tables.players,
      Item: {
        id: 1,
        name: 'Ryan',
        teams: ['BOS'],
        titleDefenses: 4,
        totalDefenses: 14,
        championships: 2,
      },
    })
    .promise();
  await db
    .put({
      TableName: tables.players,
      Item: {
        id: 2,
        name: 'Cooper',
        teams: ['TOR'],
        titleDefenses: 3,
        totalDefenses: 13,
        championships: 1,
      },
    })
    .promise();
  await db
    .put({
      TableName: tables.archive,
      Item: {
        id: 1,
        name: 'Ryan',
        teams: ['ANA'],
        titleDefenses: 8,
        totalDefenses: 10,
        championships: 1,
      },
    })
    .promise();
  await db
    .put({
      TableName: tables.options,
      Item: { id: 'draftState', state: draft },
    })
    .promise();
});
const request = async (path, method, body, season = 'season2') => {
  const result = await api({
    rawPath: path,
    requestContext: { http: { method } },
    headers: { 'x-admin-token': 'test-only' },
    queryStringParameters: { season },
    body: JSON.stringify(body),
  });
  return { ...result, json: JSON.parse(result.body) };
};
test('concurrent picks commit one roster/state transition and undo restores it', async () => {
  await db
    .update({
      TableName: tables.players,
      Key: { id: 1 },
      UpdateExpression: 'SET teams = :empty',
      ExpressionAttributeValues: { ':empty': [] },
    })
    .promise();
  const responses = await Promise.all([
    request('/draft/pick', 'POST', { playerId: 1, team: 'BOS', version: 7 }),
    request('/draft/pick', 'POST', { playerId: 1, team: 'TOR', version: 7 }),
  ]);
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409]);
  const picked = responses.find((r) => r.statusCode === 200).json;
  const player = (
    await db
      .get({ TableName: tables.players, Key: { id: 1 }, ConsistentRead: true })
      .promise()
  ).Item;
  assert.equal(player.teams.length, 1);
  assert.equal(player.totalDefenses, 14);
  const undone = await request('/draft/undo-last-pick', 'POST', {
    version: picked.state.version,
  });
  assert.equal(undone.statusCode, 200);
  assert.deepEqual(undone.json.player.teams, []);
  assert.equal(undone.json.state.currentPicker, 1);
  const archived = (
    await db
      .get({ TableName: tables.archive, Key: { id: 1 }, ConsistentRead: true })
      .promise()
  ).Item;
  assert.deepEqual(archived.teams, ['ANA']);
  assert.equal(archived.titleDefenses, 8);
});
test('failed roster condition rolls back the draft-state transaction', async () => {
  // Simulate a concurrent owner assignment after the service read.
  let raced = false;
  await db
    .update({
      TableName: tables.players,
      Key: { id: 1 },
      UpdateExpression: 'SET teams = :teams',
      ExpressionAttributeValues: { ':teams': [] },
    })
    .promise();
  const raceDb = {
    ...db,
    transactWrite: (params) => ({
      promise: async () => {
        if (!raced) {
          raced = true;
          await db
            .update({
              TableName: tables.players,
              Key: { id: 1 },
              UpdateExpression: 'SET teams = :teams',
              ExpressionAttributeValues: { ':teams': ['BOS', 'ANA'] },
            })
            .promise();
        }
        return db.transactWrite(params).promise();
      },
    }),
  };
  const { createHttpHandler } =
    await import('../../lambdas/http-api/handler.js');
  const handler = createHttpHandler({ dynamoDB: raceDb, env, https: null });
  const r = await handler({
    rawPath: '/draft/pick',
    requestContext: { http: { method: 'POST' } },
    body: JSON.stringify({ playerId: 1, team: 'BOS', version: 7 }),
  });
  assert.equal(r.statusCode, 409);
  assert.equal(
    (
      await db
        .get({
          TableName: tables.options,
          Key: { id: 'draftState' },
          ConsistentRead: true,
        })
        .promise()
    ).Item.state.version,
    7
  );
});
function nhl(gameId, gameType = 2, gameState = 'FINAL') {
  return {
    get: (url, callback) => {
      const req = new EventEmitter();
      req.setTimeout = () => {};
      queueMicrotask(() => {
        const res = new EventEmitter();
        callback(res);
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/New_York',
        }).format(new Date());
        const body = url.includes('/schedule/')
          ? {
              gameWeek: [
                {
                  date: today,
                  games: [
                    {
                      id: gameId,
                      homeTeam: { abbrev: 'BOS' },
                      awayTeam: { abbrev: 'TOR' },
                    },
                  ],
                },
              ],
            }
          : {
              gameType,
              gameState,
              homeTeam: { abbrev: 'BOS', score: 3 },
              awayTeam: { abbrev: 'TOR', score: 2 },
            };
        res.emit('data', JSON.stringify(body));
        res.emit('end');
      });
      return req;
    },
  };
}
async function seedGame(gameID) {
  await db
    .put({
      TableName: tables.options,
      Item: { id: 'currentChampion', champion: 'TOR', activeGameId: gameID },
    })
    .promise();
}
const checker = (dynamoDB, gameID, gameType = 2, gameState = 'FINAL') =>
  createChecker({
    dynamoDB,
    env,
    https: nhl(gameID, gameType, gameState),
    log: () => {},
  });
test('duplicate and concurrent finalized games increment stats exactly once', async () => {
  const id = 9001;
  await seedGame(id);
  const handler = checker(db, id);
  await Promise.all([handler({}), handler({})]);
  await handler({});
  const player = (
    await db
      .get({ TableName: tables.players, Key: { id: 1 }, ConsistentRead: true })
      .promise()
  ).Item;
  assert.equal(player.titleDefenses, 5);
  assert.equal(player.totalDefenses, 15);
  assert.equal(player.championships, 2);
  const options = (
    await db
      .get({
        TableName: tables.options,
        Key: { id: 'currentChampion' },
        ConsistentRead: true,
      })
      .promise()
  ).Item;
  assert.equal(options.activeGameId, undefined);
  assert.equal(options.checkStatus, 'finalized');
  assert.equal(
    (
      await db
        .get({
          TableName: tables.options,
          Key: { id: 'currentChampion' },
          ConsistentRead: true,
        })
        .promise()
    ).Item.champion,
    'BOS'
  );
});
test('retry after a failed stats write cannot lose the defense increment', async () => {
  const id = 9002;
  await seedGame(id);
  let failed = false;
  const failOnce = (name, params) => ({
    promise: async () => {
      if (
        !failed &&
        (params.TableName === tables.players ||
          params.TransactItems?.some(
            (i) => i.Update?.TableName === tables.players
          ))
      ) {
        failed = true;
        throw new Error('injected stats failure');
      }
      return db[name](params).promise();
    },
  });
  const injected = {
    ...db,
    update: (p) => failOnce('update', p),
    transactWrite: (p) => failOnce('transactWrite', p),
  };
  assert.equal((await checker(injected, id)({})).statusCode, 500);
  assert.equal((await checker(db, id)({})).statusCode, 200);
  const player = (
    await db
      .get({ TableName: tables.players, Key: { id: 1 }, ConsistentRead: true })
      .promise()
  ).Item;
  assert.equal(player.titleDefenses, 5);
  assert.equal(player.totalDefenses, 15);
});
test('non-regular-season games never change player totals', async () => {
  const id = 9003;
  await seedGame(id);
  assert.equal((await checker(db, id, 3)({})).statusCode, 200);
  assert.equal(
    (
      await db
        .get({
          TableName: tables.players,
          Key: { id: 1 },
          ConsistentRead: true,
        })
        .promise()
    ).Item.totalDefenses,
    14
  );
  assert.equal(
    (
      await db
        .get({ TableName: tables.records, Key: { id }, ConsistentRead: true })
        .promise()
    ).Item,
    undefined
  );
});

test('real closeout script is dry-safe and concurrent reruns award one championship', async () => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const os = require('node:os');
  const { promisify } = require('node:util');
  const execFile = promisify(require('node:child_process').execFile);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'isc-closeout-'));
  const shim = path.resolve(__dirname, 'closeout-aws-shim.cjs');
  await fs.writeFile(
    path.join(temp, 'aws'),
    `#!${process.execPath}\nrequire(${JSON.stringify(shim)});\n`,
    { mode: 0o700 }
  );
  const configPath = path.join(temp, 'lambda-config.json');
  const readPlayer = async () =>
    (
      await db
        .get({
          TableName: tables.players,
          Key: { id: 1 },
          ConsistentRead: true,
        })
        .promise()
    ).Item;
  const run = (dry) =>
    execFile(
      'bash',
      [path.resolve(__dirname, '../../scripts/aws/closeout-season.sh')],
      {
        env: {
          ...process.env,
          PATH: `${temp}:${process.env.PATH}`,
          CLOSEOUT_TEST_TABLES: JSON.stringify(tables),
          CLOSEOUT_TEST_CONFIG: configPath,
          DRY_RUN: String(dry),
          SEASON_ID: 'season2',
        },
      }
    );
  try {
    await seedGame(9999);
    await run(true);
    assert.equal((await readPlayer()).championships, 2);
    await assert.rejects(fs.access(configPath));
    await Promise.all([run(false), run(false)]);
    await run(false);
    const player = await readPlayer();
    assert.equal(player.championships, 3);
    assert.equal(player.lastChampionshipAwardSeason, 'season2');
    assert.equal(player.titleDefenses, 4);
    assert.equal(player.totalDefenses, 14);
    assert.equal(
      JSON.parse(await fs.readFile(configPath)).Variables.SEASON2_SEASON_OVER,
      'true'
    );
    const archived = (
      await db
        .get({
          TableName: tables.archive,
          Key: { id: 1 },
          ConsistentRead: true,
        })
        .promise()
    ).Item;
    assert.equal(archived.championships, 1);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('an in-progress game schedules another check without awarding defenses', async () => {
  const id = 9004;
  await seedGame(id);
  assert.equal((await checker(db, id, 2, 'LIVE')({})).statusCode, 200);
  const options = (
    await db
      .get({
        TableName: tables.options,
        Key: { id: 'currentChampion' },
        ConsistentRead: true,
      })
      .promise()
  ).Item;
  assert.equal(options.checkStatus, 'watching');
  assert.equal(options.activeGameId, id);
  assert.ok(Date.parse(options.nextCheckAt) > Date.now());
  const player = (
    await db
      .get({ TableName: tables.players, Key: { id: 1 }, ConsistentRead: true })
      .promise()
  ).Item;
  assert.equal(player.totalDefenses, 14);
});
test('existing legacy game records never trigger speculative counter repairs', async () => {
  const id = 9005;
  await seedGame(id);
  await db
    .put({
      TableName: tables.records,
      Item: { id, wTeam: 'BOS', lTeam: 'TOR' },
    })
    .promise();
  assert.equal((await checker(db, id)({})).statusCode, 200);
  const player = (
    await db
      .get({ TableName: tables.players, Key: { id: 1 }, ConsistentRead: true })
      .promise()
  ).Item;
  assert.equal(player.totalDefenses, 14);
  const record = (
    await db
      .get({ TableName: tables.records, Key: { id }, ConsistentRead: true })
      .promise()
  ).Item;
  assert.equal(record.statsApplied, undefined);
});
