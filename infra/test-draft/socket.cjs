// Dedicated Test connections only. Payloads are invalidations, never client state.
const {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand,
} = require('@aws-sdk/client-dynamodb');
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require('@aws-sdk/client-apigatewaymanagementapi');
const db = new DynamoDBClient({});
exports.handler = async (event) => {
  const { connectionId, routeKey, domainName, stage } = event.requestContext;
  const TableName = process.env.CONNECTIONS_TABLE;
  if (routeKey === '$connect') {
    await db.send(
      new PutItemCommand({
        TableName,
        Item: {
          connectionId: { S: connectionId },
          expiresAt: { N: String(Math.floor(Date.now() / 1000) + 10800) },
        },
      })
    );
    return { statusCode: 200 };
  }
  const remove = (id) =>
    db.send(
      new DeleteItemCommand({ TableName, Key: { connectionId: { S: id } } })
    );
  if (routeKey === '$disconnect') {
    await remove(connectionId);
    return { statusCode: 200 };
  }
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400 };
  }
  if (body.action !== 'default') return { statusCode: 400 };
  const api = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });
  let cursor;
  do {
    const page = await db.send(
      new ScanCommand({ TableName, ExclusiveStartKey: cursor })
    );
    await Promise.all(
      (page.Items || []).map(async (item) => {
        const id = item.connectionId.S;
        try {
          await api.send(
            new PostToConnectionCommand({
              ConnectionId: id,
              Data: Buffer.from(
                JSON.stringify({
                  type: 'draftUpdate',
                  source: 'test',
                  sentAt: new Date().toISOString(),
                  payload: {},
                })
              ),
            })
          );
        } catch (error) {
          if (error.$metadata?.httpStatusCode === 410) await remove(id);
          else throw error;
        }
      })
    );
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return { statusCode: 200 };
};
