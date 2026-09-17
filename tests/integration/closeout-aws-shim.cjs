// Run the real closeout shell script without permitting real Lambda changes.
// DynamoDB operations use the integration test's explicitly allowed tables only.
const fs = require('node:fs');
const {
  DynamoDBClient,
  GetItemCommand,
  ScanCommand,
  UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');
async function main() {
  const [service, action, ...args] = process.argv.slice(2);
  const arg = (name) => args[args.indexOf(name) + 1];
  const tables = JSON.parse(process.env.CLOSEOUT_TEST_TABLES);
  if (service === 'lambda') {
    if (action === 'get-function-configuration') {
      console.log(
        JSON.stringify({
          PLAYERS_TABLE: tables.players,
          GAME_OPTIONS_TABLE: tables.options,
        })
      );
    } else if (action === 'update-function-configuration') {
      const input = JSON.parse(
        fs.readFileSync(arg('--environment').replace(/^file:\/\//, ''), 'utf8')
      );
      if (input.Variables.SEASON2_SEASON_OVER !== 'true')
        throw new Error('Expected season closeout flag');
      fs.writeFileSync(process.env.CLOSEOUT_TEST_CONFIG, JSON.stringify(input));
      console.log('{}');
    } else throw new Error('Unexpected Lambda operation');
    return;
  }
  const TableName = arg('--table-name');
  if (
    service !== 'dynamodb' ||
    !Object.values(tables).includes(TableName) ||
    !TableName.startsWith('isc-phase2-test-')
  )
    throw new Error('Unsafe test operation');
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(process.env.DYNAMODB_TEST_AWS === 'true'
      ? {}
      : {
          endpoint:
            process.env.DYNAMODB_TEST_ENDPOINT || 'http://localhost:8000',
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }),
  });
  const params = { TableName };
  const fields = {
    '--key': ['Key', true],
    '--projection-expression': ['ProjectionExpression'],
    '--update-expression': ['UpdateExpression'],
    '--condition-expression': ['ConditionExpression'],
    '--expression-attribute-values': ['ExpressionAttributeValues', true],
    '--return-values': ['ReturnValues'],
  };
  for (const [flag, [key, json]] of Object.entries(fields))
    if (args.includes(flag))
      params[key] = json ? JSON.parse(arg(flag)) : arg(flag);
  const Command = {
    'get-item': GetItemCommand,
    scan: ScanCommand,
    'update-item': UpdateItemCommand,
  }[action];
  if (!Command) throw new Error('Unexpected DynamoDB operation');
  try {
    console.log(JSON.stringify(await client.send(new Command(params))));
  } finally {
    client.destroy();
  }
}
main().catch((error) => {
  console.error(error.name, error.message);
  process.exitCode = 1;
});
