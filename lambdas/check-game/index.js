const https = require('https');
const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const TABLE_NAME = process.env.GAME_OPTIONS_TABLE || 'GameOptions';
const PLAYERS_TABLE = process.env.PLAYERS_TABLE || 'Players';
const GAME_RECORDS = process.env.GAME_RECORDS_TABLE || 'GameRecords';
const PARTITION_KEY = process.env.GAME_OPTIONS_KEY || 'currentChampion';
const GAME_ID_FIELD = process.env.GAME_ID_FIELD || 'gameID';
const CHAMPION_FIELD = process.env.CHAMPION_FIELD || 'champion';
const NHL_API_BASE =
  process.env.NHL_API_BASE || process.env.API_URL || 'https://api-web.nhle.com/v1';

function log(level, msg, extra = {}) {
  const base = { level, ts: new Date().toISOString(), ...extra };
  console.log(JSON.stringify({ msg, ...base }));
}

async function getGameOptions() {
  const params = { TableName: TABLE_NAME, Key: { id: PARTITION_KEY } };
  try {
    const result = await dynamoDB.get(params).promise();
    return result.Item || {};
  } catch (error) {
    log('error', 'DynamoDB get (GameOptions) failed', { error: String(error) });
    throw new Error('Failed to retrieve game options');
  }
}

async function setGameId(gameID) {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression: 'SET #gid = :g, updatedAt = :ts',
    ExpressionAttributeNames: { '#gid': GAME_ID_FIELD },
    ExpressionAttributeValues: {
      ':g': gameID,
      ':ts': new Date().toISOString(),
    },
    ReturnValues: 'UPDATED_NEW',
  };
  const out = await dynamoDB.update(params).promise();
  return out?.Attributes?.[GAME_ID_FIELD] ?? gameID;
}

function getDateInTimeZone(offsetDays = 0, tz = 'America/New_York') {
  const date = new Date();
  if (offsetDays) {
    date.setUTCDate(date.getUTCDate() + offsetDays);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function fetchSchedule(date) {
  const apiUrl = `${NHL_API_BASE}/schedule/${date}`;
  return new Promise((resolve, reject) => {
    const req = https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          log('error', 'JSON parse error from NHL schedule API', {
            error: String(e),
            snippet: data?.slice?.(0, 240),
          });
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      log('error', 'API request error', { error: String(e), url: apiUrl });
      reject(e);
    });

    req.setTimeout(8000, () => {
      log('error', 'API request timed out', { url: apiUrl });
      req.destroy(new Error('Request timeout'));
    });
  });
}

function findChampionGame(schedule, champion, date) {
  const gameWeek = schedule?.gameWeek;
  if (!Array.isArray(gameWeek)) return null;
  const today = gameWeek.find((d) => d?.date === date);
  const games = today?.games || [];
  for (const g of games) {
    const home = g?.homeTeam?.abbrev;
    const away = g?.awayTeam?.abbrev;
    if (home === champion || away === champion) return g.id;
  }
  return null;
}

async function resolveGameIdFromSchedule(champion) {
  const datesToTry = [getDateInTimeZone(0), getDateInTimeZone(-1)];
  for (const date of datesToTry) {
    const schedule = await fetchSchedule(date);
    const found = findChampionGame(schedule, champion, date);
    if (found) return { gameID: found, date };
  }
  return null;
}

async function fetchGameData(gameID) {
  const apiUrl = `${NHL_API_BASE}/gamecenter/${gameID}/boxscore`;

  return new Promise((resolve, reject) => {
    const req = https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const gameData = JSON.parse(data);

          const homeTeam = gameData.homeTeam;
          const awayTeam = gameData.awayTeam;
          const gameState = gameData.gameState;
          const gameType = gameData.gameType;

          resolve({
            gameState,
            gameType,
            homeAbbrev: homeTeam?.abbrev,
            awayAbbrev: awayTeam?.abbrev,
            homeScore: homeTeam?.score,
            awayScore: awayTeam?.score,
          });
        } catch (e) {
          log('error', 'JSON parse error from NHL API', {
            error: String(e),
            snippet: data?.slice?.(0, 240),
          });
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      log('error', 'API request error', { error: String(e), url: apiUrl });
      reject(e);
    });

    req.setTimeout(8000, () => {
      log('error', 'API request timed out', { url: apiUrl });
      req.destroy(new Error('Request timeout'));
    });
  });
}

async function saveWinnerToDatabase(winner) {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression: 'SET champion = :winner',
    ExpressionAttributeValues: { ':winner': winner },
    ReturnValues: 'UPDATED_NEW',
  };
  const out = await dynamoDB.update(params).promise();
  log('info', 'Champion updated', { winner, updated: out?.Attributes });
}

async function findPlayerWithTeam(team) {
  const params = { TableName: PLAYERS_TABLE };
  try {
    const result = await dynamoDB.scan(params).promise();
    const player = result.Items?.find(
      (p) => Array.isArray(p.teams) && p.teams.includes(team)
    );
    return player ? player.id : null;
  } catch (error) {
    log('error', 'Players scan failed', { error: String(error) });
    throw new Error('Failed to find player with winning team');
  }
}

async function incrementTitleDefense(playerId, team) {
  const params = {
    TableName: PLAYERS_TABLE,
    Key: { id: playerId },
    UpdateExpression:
      'SET titleDefenses = if_not_exists(titleDefenses, :zero) + :inc, totalDefenses = if_not_exists(totalDefenses, :zero) + :inc',
    ExpressionAttributeValues: { ':inc': 1, ':zero': 0 },
    ReturnValues: 'UPDATED_NEW',
  };
  const out = await dynamoDB.update(params).promise();
  log('info', 'Player defenses incremented', {
    playerId,
    team,
    updated: out?.Attributes,
  });
}

async function clearGameID() {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression: `REMOVE ${GAME_ID_FIELD}`,
    ReturnValues: 'UPDATED_NEW',
  };

  try {
    const out = await dynamoDB.update(params).promise();
    log('info', 'Cleared gameID from GameOptions', {
      updated: out?.Attributes,
    });
  } catch (error) {
    log('error', 'Failed to clear gameID', { error: String(error) });
  }
}

async function saveGameStats(gameID, wTeam, wScore, lTeam, lScore) {
  const params = {
    TableName: GAME_RECORDS,
    Item: {
      id: gameID,
      wTeam,
      wScore,
      lTeam,
      lScore,
      savedAt: new Date().toISOString(),
    },
    ConditionExpression: 'attribute_not_exists(id)',
  };

  try {
    await dynamoDB.put(params).promise();
    log('info', 'Game record saved', { gameID, wTeam, wScore, lTeam, lScore });
  } catch (e) {
    if (e.code === 'ConditionalCheckFailedException') {
      log('info', 'Game record already exists, skipping save', { gameID });
      return;
    }
    throw e;
  }
}

async function getSavedGame(gameID) {
  const params = { TableName: GAME_RECORDS, Key: { id: gameID } };
  try {
    const result = await dynamoDB.get(params).promise();
    return result.Item;
  } catch (error) {
    log('error', 'GameRecords get failed', { error: String(error) });
    throw new Error('Failed to retrieve game record');
  }
}

function isFinished(gameState) {
  if (!gameState) return false;
  const normalized = String(gameState).toUpperCase();
  return ['OFF', 'FINAL', 'COMPLETED', 'OVER'].includes(normalized);
}

const handler = async (event, context) => {
  log('info', 'Invocation start', {
    requestId: context?.awsRequestId,
    trigger: event?.source || 'manual/test',
    detailType: event?.detailType,
  });

  try {
    const gameOptions = await getGameOptions();
    let gameID = gameOptions?.[GAME_ID_FIELD] ?? null;

    if (!gameID) {
      const champion = gameOptions?.[CHAMPION_FIELD] ?? null;
      if (!champion) {
        log('info', 'No champion set in GameOptions; exiting early');
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'No champion to check' }),
        };
      }

      const resolved = await resolveGameIdFromSchedule(champion);
      if (!resolved?.gameID) {
        log('info', 'No champion game found in schedule; exiting early', {
          champion,
        });
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'No champion game found' }),
        };
      }

      gameID = resolved.gameID;
      await setGameId(gameID);
      log('info', 'Resolved gameID from schedule', {
        champion,
        gameID,
        date: resolved.date,
      });
    }
    log('info', 'GameID loaded', { gameID });

    const game = await fetchGameData(gameID);
    log('info', 'Game state fetched', {
      gameID,
      gameState: game.gameState,
      gameType: game.gameType,
      matchup: `${game.homeAbbrev} vs ${game.awayAbbrev}`,
      score: `${game.homeScore}-${game.awayScore}`,
    });

    if (typeof game.gameType !== 'undefined' && game.gameType !== 2) {
      log('info', 'Non-regular-season game; skipping', {
        gameType: game.gameType,
        gameID,
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Not a regular season game' }),
      };
    }

    if (!isFinished(game.gameState)) {
      log('info', 'Game not finished yet', {
        gameID,
        gameState: game.gameState,
      });
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Game ${gameID} not finished (${game.gameState})`,
        }),
      };
    }

    const wTeam =
      game.homeScore > game.awayScore ? game.homeAbbrev : game.awayAbbrev;
    const lTeam =
      game.homeScore > game.awayScore ? game.awayAbbrev : game.homeAbbrev;
    const wScore = Math.max(game.homeScore, game.awayScore);
    const lScore = Math.min(game.homeScore, game.awayScore);
    log('info', 'Winner determined', { gameID, wTeam, wScore, lTeam, lScore });

    const alreadySaved = await getSavedGame(gameID);
    if (alreadySaved) {
      log('info', 'Game already saved; skipping winner writes', { gameID });
      await clearGameID();
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Game already processed' }),
      };
    }

    await saveGameStats(gameID, wTeam, wScore, lTeam, lScore);
    await saveWinnerToDatabase(wTeam);
    await clearGameID();

    const playerId = await findPlayerWithTeam(wTeam);
    if (playerId) {
      await incrementTitleDefense(playerId, wTeam);
    } else {
      log('info', 'No player found for winning team', { wTeam });
    }

    log('info', 'Invocation complete', { gameID, champion: wTeam });
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Winner ${wTeam} saved` }),
    };
  } catch (error) {
    log('error', 'Handler error', { error: String(error) });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process request' }),
    };
  }
};

module.exports = { handler };
