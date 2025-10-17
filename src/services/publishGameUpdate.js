import AWS from 'aws-sdk';
import axios from 'axios';

const ddb = new AWS.DynamoDB.DocumentClient();
const apigw = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT, // e.g. wss://ul86529ski.execute-api.us-east-1.amazonaws.com/prod
});

export const handler = async (event) => {
  console.log('🏒 publishGameUpdate triggered', new Date().toISOString());

  const devMode = event.queryStringParameters?.dev === 'true';
  const TABLE_NAME = 'GameOptions';
  const SOCKET_TABLE = 'SocketConnections';

  // Always fetch tick from DynamoDB
  const { Item } = await ddb
    .get({
      TableName: TABLE_NAME,
      Key: { id: 'devTick' },
    })
    .promise();

  let tick = Item?.tick ?? 0;

  // ------------------------------------------
  // 🧪 DEV MODE - Generate Fake Game Data
  // ------------------------------------------
  let gameData;
  if (devMode) {
    const MAX_SECONDS = 24 * 60 + 59; // 24:59
    const remaining = (MAX_SECONDS - tick) % (MAX_SECONDS + 1);
    const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
    const secs = String(remaining % 60).padStart(2, '0');
    const clock = `${mins}:${secs}`;

    const intervals = Math.floor(tick / 120);
    const homeScore = Math.floor((intervals + 1) / 2);
    const awayScore = Math.floor(intervals / 2);

    if (tick >= MAX_SECONDS) tick = 0;
    else tick++;

    // Persist tick
    await ddb
      .put({
        TableName: TABLE_NAME,
        Item: { id: 'devTick', tick },
      })
      .promise();

    gameData = {
      gameId: 'DEV-MOCK',
      gameState: 'LIVE',
      homeTeam: { id: 1, score: homeScore, sog: 10 + homeScore * 3 },
      awayTeam: { id: 2, score: awayScore, sog: 10 + awayScore * 3 },
      clock: { timeRemaining: clock },
    };

    console.log(
      `Tick: ${tick} | Clock: ${clock} | Home: ${homeScore} | Away: ${awayScore}`
    );
  } else {
    // Normal live-game logic
    const gameId = process.env.GAME_ID;
    const resp = await axios.get(
      `${process.env.API_URL}/gamecenter/${gameId}/boxscore`
    );
    gameData = resp.data;
  }

  // ------------------------------------------
  // 🔄 Broadcast to WebSocket Clients
  // ------------------------------------------
  const connections = await ddb.scan({ TableName: SOCKET_TABLE }).promise();

  const payload = {
    type: 'liveGameUpdate',
    payload: gameData,
  };

  await Promise.all(
    connections.Items.map(async (conn) => {
      try {
        await apigw
          .postToConnection({
            ConnectionId: conn.connectionId,
            Data: JSON.stringify(payload),
          })
          .promise();
      } catch (err) {
        if (err.statusCode === 410) {
          console.log('Removing stale connection:', conn.connectionId);
          await ddb
            .delete({
              TableName: SOCKET_TABLE,
              Key: { connectionId: conn.connectionId },
            })
            .promise();
        } else {
          console.error('Failed to send message:', err);
        }
      }
    })
  );

  return { statusCode: 200, body: 'Game update broadcast complete.' };
};
