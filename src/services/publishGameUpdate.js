import AWS from 'aws-sdk';
import axios from 'axios';

const ddb = new AWS.DynamoDB.DocumentClient();

// IMPORTANT: This endpoint must be the HTTPS stage URL, e.g.:
// https://ul86529ski.execute-api.us-east-1.amazonaws.com/prod
const apigw = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});

export const handler = async (event) => {
  const nowIso = new Date().toISOString();
  console.log('🏒 publishGameUpdate triggered at', nowIso);

  // --- Endpoint sanity checks ---
  const mgmtEndpoint = process.env.WEBSOCKET_ENDPOINT || '';
  console.log('Mgmt endpoint:', mgmtEndpoint);
  if (!mgmtEndpoint) {
    console.error(
      '❌ WEBSOCKET_ENDPOINT is not set. Must be the HTTPS stage URL.'
    );
    return { statusCode: 500, body: 'Missing WEBSOCKET_ENDPOINT' };
  }
  if (mgmtEndpoint.startsWith('wss://')) {
    console.warn(
      '⚠️ WEBSOCKET_ENDPOINT is wss:// — it should be HTTPS (https://.../stage) for postToConnection.'
    );
  }
  if (!/https:\/\/.+\.execute-api\..+\.amazonaws\.com\/.+/.test(mgmtEndpoint)) {
    console.warn(
      '⚠️ WEBSOCKET_ENDPOINT does not look like an API Gateway HTTPS stage URL (https://...execute-api.../stage).'
    );
  }

  const devMode = event?.queryStringParameters?.dev === 'true';
  const TABLE_NAME = 'GameOptions';
  const SOCKET_TABLE = 'SocketConnections';

  // --- Load tick from DynamoDB ---
  let tick = 0;
  try {
    const { Item } = await ddb
      .get({
        TableName: TABLE_NAME,
        Key: { id: 'devTick' },
      })
      .promise();
    tick = Item?.tick ?? 0;
    console.log('Loaded tick from DynamoDB:', tick);
  } catch (e) {
    console.error('❌ Failed to load devTick:', e);
  }

  // ------------------------------------------
  // 🧪 DEV MODE - Generate Fake Game Data
  // ------------------------------------------
  let gameData;
  if (devMode) {
    const MAX_SECONDS = 24 * 60 + 59; // 24:59 => 1499 seconds
    const remaining = (MAX_SECONDS - tick) % (MAX_SECONDS + 1);
    const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
    const secs = String(remaining % 60).padStart(2, '0');
    const clock = `${mins}:${secs}`;

    const intervals = Math.floor(tick / 120); // every 2 minutes
    const homeScore = Math.floor((intervals + 1) / 2); // home scores first
    const awayScore = Math.floor(intervals / 2);

    // increment / loop tick
    const nextTick = tick >= MAX_SECONDS ? 0 : tick + 1;
    try {
      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: { id: 'devTick', tick: nextTick },
        })
        .promise();
      console.log(`Tick advanced ${tick} -> ${nextTick}`);
    } catch (e) {
      console.error('❌ Failed to persist devTick:', e);
    }

    gameData = {
      id: 'DEV-MOCK',
      gameId: 'DEV-MOCK',
      gameState: 'LIVE',
      homeTeam: {
        id: 1,
        abbrev: 'HOM',
        score: homeScore,
        sog: 10 + homeScore * 3,
      },
      awayTeam: {
        id: 2,
        abbrev: 'AWY',
        score: awayScore,
        sog: 10 + awayScore * 3,
      },
      clock: { timeRemaining: clock, secondsRemaining: remaining },
      startTimeUTC: nowIso,
    };

    console.log(
      `🧪 DEV data -> clock: ${clock} (${remaining}s), home: ${homeScore}, away: ${awayScore}`
    );
  } else {
    // ------------------------------------------
    // 🌐 LIVE MODE - Fetch from NHL API via proxy
    // ------------------------------------------
    const gameId = process.env.GAME_ID;
    const apiUrl = process.env.API_URL;
    if (!gameId || !apiUrl) {
      console.error(
        '❌ Missing GAME_ID and/or API_URL env vars for live mode.'
      );
      return { statusCode: 500, body: 'Missing GAME_ID or API_URL' };
    }
    try {
      const resp = await axios.get(`${apiUrl}/gamecenter/${gameId}/boxscore`);
      gameData = resp.data;
      console.log('Fetched live game data for', gameId);
    } catch (e) {
      console.error(
        '❌ Failed to fetch live game data:',
        e?.response?.status,
        e?.response?.data || e?.message
      );
      return { statusCode: 502, body: 'Failed to fetch live game data' };
    }
  }

  // ------------------------------------------
  // 🔄 Broadcast to WebSocket Clients
  // ------------------------------------------
  let connections = { Items: [] };
  try {
    connections = await ddb.scan({ TableName: SOCKET_TABLE }).promise();
  } catch (e) {
    console.error('❌ Failed to scan SocketConnections:', e);
    return { statusCode: 500, body: 'Failed to load connections' };
  }

  const total = connections.Items.length;
  const sample = connections.Items.slice(0, 5).map((c) => c.connectionId);
  console.log(`Broadcasting to ${total} connections. Sample:`, sample);

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
        // Detailed diagnostics for 403/410/etc.
        console.log('postToConnection error', {
          code: err.code,
          statusCode: err.statusCode,
          requestId: err.requestId,
          endpoint: mgmtEndpoint,
          connectionId: conn.connectionId,
        });

        if (err.statusCode === 410) {
          // Stale connection—clean it up
          try {
            await ddb
              .delete({
                TableName: SOCKET_TABLE,
                Key: { connectionId: conn.connectionId },
              })
              .promise();
            console.log('🧹 Removed stale connection:', conn.connectionId);
          } catch (delErr) {
            console.error(
              '❌ Failed to delete stale connection:',
              conn.connectionId,
              delErr
            );
          }
        } else if (err.statusCode === 403) {
          console.error(
            '🚫 Forbidden: Check Lambda execution role has execute-api:ManageConnections to this API/stage and endpoint is HTTPS with stage.'
          );
        } else {
          console.error('❌ Failed to send message:', err);
        }
      }
    })
  );

  console.log('✅ Game update broadcast complete.');
  return { statusCode: 200, body: 'Game update broadcast complete.' };
};
