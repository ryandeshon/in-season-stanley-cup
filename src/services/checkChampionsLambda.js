import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const GAME_OPTIONS_TABLE = 'GameOptions';
const PARTITION_KEY = 'currentChampion';
const GAME_RECORDS_TABLE = 'GameRecords';
const PLAYERS_TABLE = 'Players';
const API_URL = process.env.API_URL; // proxy base

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'http://localhost:8080', // or "*"
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

// ---- tiny structured logger (single-line JSON for CloudWatch) ----
function log(level, msg, meta = {}) {
  console.log(
    JSON.stringify({ level, msg, ts: new Date().toISOString(), ...meta })
  );
}

// ---- New: get New York–local YYYY-MM-DD regardless of Lambda's UTC clock ----
function getLocalDateYYYYMMDD(tz = 'America/New_York', d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA gives YYYY-MM-DD directly
  return fmt.format(d);
}

// ---- DynamoDB reads/writes ----
async function getCurrentChampion() {
  const params = { TableName: GAME_OPTIONS_TABLE, Key: { id: PARTITION_KEY } };
  try {
    const res = await dynamoDB.get(params).promise();
    return res.Item?.champion ?? null;
  } catch (err) {
    log('error', 'DDB get GameOptions failed', { error: String(err) });
    throw err;
  }
}

async function setGameID(gameID) {
  if (gameID) {
    const params = {
      TableName: GAME_OPTIONS_TABLE,
      Key: { id: PARTITION_KEY },
      UpdateExpression: 'SET gameID = :g',
      ExpressionAttributeValues: { ':g': gameID },
      ReturnValues: 'UPDATED_NEW',
    };
    const out = await dynamoDB.update(params).promise();
    log('info', 'Saved gameID', { gameID, updated: out?.Attributes });
  } else {
    // Remove attribute instead of writing null
    const params = {
      TableName: GAME_OPTIONS_TABLE,
      Key: { id: PARTITION_KEY },
      UpdateExpression: 'REMOVE gameID',
      ReturnValues: 'UPDATED_NEW',
    };
    const out = await dynamoDB.update(params).promise();
    log('info', 'Removed gameID (no game today)', { updated: out?.Attributes });
  }
}

// ---- NHL schedule fetch ----
async function fetchSchedule(dateYYYYMMDD) {
  const url = `${API_URL}/schedule/${dateYYYYMMDD}`;
  log('info', 'Fetching schedule', { url });

  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          log('error', 'Schedule JSON parse error', {
            error: String(e),
            snippet: data.slice?.(0, 240),
          });
          reject(e);
        }
      });
    });
    req.on('error', (e) => {
      log('error', 'Schedule request error', { error: String(e), url });
      reject(e);
    });
    req.setTimeout(8000, () => {
      log('error', 'Schedule request timeout', { url });
      req.destroy(new Error('timeout'));
    });
  });
}

// ---- Find today’s game for champion ----
function findChampionsGameForDate(scheduleJson, champion, dateYYYYMMDD) {
  const gameWeek = scheduleJson?.gameWeek;
  if (!Array.isArray(gameWeek)) {
    log('warn', 'schedule.gameWeek missing/invalid', {
      keys: Object.keys(scheduleJson || {}),
    });
    return null;
  }

  const today = gameWeek.find((d) => d?.date === dateYYYYMMDD);
  const games = today?.games || [];
  log('info', 'Schedule day loaded', {
    date: dateYYYYMMDD,
    totalGames: games.length,
  });

  for (const g of games) {
    const home = g?.homeTeam?.abbrev;
    const away = g?.awayTeam?.abbrev;
    if (!home || !away) continue;
    if (home === champion || away === champion) {
      log('info', 'Champion game found', {
        gameID: g.id,
        home,
        away,
        champion,
      });
      return g.id;
    }
  }
  return null;
}

// ---- Handler ----
export const handler = async (event, context) => {
  const path = event?.path || '';
  const method = event?.httpMethod || 'GET';

  console.log('incoming', { path, method });

  // 1) GET /game-records
  if (path === '/game-records' && method === 'GET') {
    try {
      const res = await dynamoDB
        .scan({ TableName: GAME_RECORDS_TABLE })
        .promise();
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(res.Items || []),
      };
    } catch (err) {
      console.error('scan GameRecords failed', err);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Failed to fetch game records' }),
      };
    }
  }

  // 2) GET /players
  if (path === '/players' && method === 'GET') {
    try {
      const res = await dynamoDB.scan({ TableName: PLAYERS_TABLE }).promise();
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(res.Items || []),
      };
    } catch (err) {
      console.error('scan Players failed', err);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Failed to fetch players' }),
      };
    }
  }

  // 3) GET /players/{name}
  if (path.startsWith('/players/') && method === 'GET') {
    const name = decodeURIComponent(path.split('/').pop());
    try {
      const res = await dynamoDB
        .query({
          TableName: PLAYERS_TABLE,
          IndexName: 'NameIndex',
          KeyConditionExpression: '#n = :name',
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: { ':name': name },
        })
        .promise();
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(res.Items?.[0] || null),
      };
    } catch (err) {
      console.error('query player by name failed', err);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Failed to fetch player' }),
      };
    }
  }

  // 4) existing /gameid route (the one we added earlier)
  if (path.endsWith('/gameid') && method === 'GET') {
    try {
      const res = await dynamoDB
        .get({ TableName: 'GameOptions', Key: { id: 'currentChampion' } })
        .promise();
      const gameID = res.Item?.gameID ?? null;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ gameID }),
      };
    } catch (err) {
      console.error('get gameID failed', err);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Failed to retrieve gameID' }),
      };
    }
  }

  // 5) existing /champion route (the one that checks today’s game)
  if (path.endsWith('/champion') && method === 'GET') {
    // keep your existing champion logic here
    // make sure every return has:
    // statusCode, headers: CORS_HEADERS, body: JSON.stringify(...)
  }

  // fallback
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'Not found', path }),
  };
};
