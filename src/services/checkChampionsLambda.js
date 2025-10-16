import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'GameOptions';
const PARTITION_KEY = 'currentChampion';
const API_URL = process.env.API_URL; // proxy base

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
  const params = { TableName: TABLE_NAME, Key: { id: PARTITION_KEY } };
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
      TableName: TABLE_NAME,
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
      TableName: TABLE_NAME,
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
  log('info', 'CheckNHLChampion start', {
    requestId: context?.awsRequestId,
    trigger: event?.source || 'manual/test',
    detailType: event?.detailType,
  });

  try {
    const champion = await getCurrentChampion();
    if (!champion) {
      log('info', 'No current champion in DB; exiting');
      await setGameID(null);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No current champion' }),
      };
    }

    const dateNY = getLocalDateYYYYMMDD('America/New_York');
    log('info', 'Using local date for schedule', { dateNY, champion });

    const schedule = await fetchSchedule(dateNY);
    const gameID = findChampionsGameForDate(schedule, champion, dateNY);

    if (gameID) {
      await setGameID(gameID);
      log('info', 'Game ID saved for champion', { gameID, champion, dateNY });
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Game ID ${gameID} saved for ${champion}`,
        }),
      };
    } else {
      await setGameID(null);
      log('info', 'No game scheduled for champion today', { champion, dateNY });
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `No game scheduled for ${champion} on ${dateNY}`,
        }),
      };
    }
  } catch (error) {
    log('error', 'CheckNHLChampion error', { error: String(error) });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process request' }),
    };
  }
};
