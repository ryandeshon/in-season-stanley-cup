const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require('@aws-sdk/client-apigatewaymanagementapi');
const { createHandler } = require('./handler.cjs');
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const socket = new ApiGatewayManagementApiClient({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});
const db = Object.fromEntries(
  [
    ['get', GetCommand],
    ['scan', ScanCommand],
    ['delete', DeleteCommand],
  ].map(([name, Command]) => [
    name,
    (params) => ({ promise: () => client.send(new Command(params)) }),
  ])
);
exports.handler = createHandler({
  db,
  env: process.env,
  post: (connectionId, data) =>
    socket.send(
      new PostToConnectionCommand({ ConnectionId: connectionId, Data: data })
    ),
  getGame: async (id) => {
    const response = await fetch(
      `https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) throw new Error(`NHL returned ${response.status}`);
    return response.json();
  },
});
