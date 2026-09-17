// Offline plans by default; DynamoDB writes require --apply and an explicit prefix.
const fs = require('node:fs');
const {
  planMigration,
  applyMigration,
  schema,
  definitions,
  hash,
} = require('./migration.cjs');
const { config, collect } = require('../../lambdas/shared/season-storage.cjs');
const { transition } = require('../../lambdas/shared/season-lifecycle.cjs');
const {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  waitUntilTableExists,
} = require('@aws-sdk/client-dynamodb');
const lib = require('@aws-sdk/lib-dynamodb');
function connect({ endpoint = 'http://localhost:8000', aws = false } = {}) {
  if (!aws && !['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname))
    throw new Error('Non-local access requires --aws');
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(aws
      ? {}
      : {
          endpoint,
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }),
  });
  const doc = lib.DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  const commands = {
    get: lib.GetCommand,
    put: lib.PutCommand,
    update: lib.UpdateCommand,
    query: lib.QueryCommand,
    scan: lib.ScanCommand,
    transactWrite: lib.TransactWriteCommand,
  };
  const db = Object.fromEntries(
    Object.entries(commands).map(([name, C]) => [
      name,
      (p) => ({
        promise: async () => {
          try {
            return await doc.send(new C(p));
          } catch (e) {
            e.code = e.name;
            throw e;
          }
        },
      }),
    ])
  );
  db.describeTable = (p) => ({
    promise: () => client.send(new DescribeTableCommand(p)),
  });
  return { db, client };
}
async function createTables(client, tables) {
  for (const kind of Object.keys(definitions)) {
    await client.send(new CreateTableCommand(schema(tables[kind], kind)));
    await waitUntilTableExists(
      { client, minDelay: 1, maxWaitTime: 90 },
      { TableName: tables[kind] }
    );
  }
}
async function snapshot(db, tables) {
  const rows = {};
  for (const kind of Object.keys(definitions))
    rows[kind] = (
      await collect(db, 'scan', {
        TableName: tables[kind],
        ConsistentRead: true,
      })
    ).sort((a, b) =>
      JSON.stringify([a.seasonId, a.id]).localeCompare(
        JSON.stringify([b.seasonId, b.id])
      )
    );
  return { version: 1, rows, targetHash: hash(rows) };
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const has = (s) => args.includes(`--${s}`);
  const arg = (s) => {
    const i = args.indexOf(`--${s}`);
    return i < 0 ? undefined : args[i + 1];
  };
  const read = (s) => JSON.parse(fs.readFileSync(arg(s), 'utf8'));
  const save = (value) => {
    if (!arg('output')) throw new Error('--output required');
    fs.writeFileSync(arg('output'), JSON.stringify(value, null, 2), {
      mode: 0o600,
      flag: 'wx',
    });
  };
  if (command === 'plan') {
    const plan = planMigration(read('source'), {
      acceptStoredTotals: has('accept-stored-totals'),
    });
    save(plan);
    console.log(
      JSON.stringify({
        targetHash: plan.targetHash,
        anomalies: plan.anomalies,
        counts: Object.fromEntries(
          Object.entries(plan.rows).map(([k, v]) => [k, v.length])
        ),
      })
    );
    return;
  }
  const prefix = arg('prefix');
  if (!prefix || !/^isc-(phase3|season)-[a-z0-9-]+-$/.test(prefix))
    throw new Error(
      'Explicit isc-phase3-<run>- or isc-season-<version>- prefix required'
    );
  const tables = Object.fromEntries(
    Object.keys(definitions).map((k) => [k, prefix + k])
  );
  const { db, client } = connect({
    aws: has('aws'),
    endpoint: arg('endpoint'),
  });
  try {
    if (command === 'create') {
      if (!has('apply')) throw new Error('create requires --apply');
      await createTables(client, tables);
    } else if (command === 'apply') {
      const manifest = read('manifest');
      if (
        manifest.sourceHash &&
        (!arg('source') || hash(read('source')) !== manifest.sourceHash)
      )
        throw new Error('Source fingerprint changed or --source missing');
      console.log(
        await applyMigration(db, tables, manifest, {
          apply: has('apply'),
        })
      );
    } else if (command === 'snapshot') save(await snapshot(db, tables));
    else if (command === 'transition') {
      const request = read('request');
      if (!has('apply')) {
        console.log({ dryRun: true, request });
        return;
      }
      console.log(
        await transition(
          db,
          tables,
          request.seasonId,
          request.expectedRevision,
          request
        )
      );
    } else
      throw new Error('Commands: plan, create, apply, snapshot, transition');
  } finally {
    client.destroy();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { connect, createTables, snapshot, config };
