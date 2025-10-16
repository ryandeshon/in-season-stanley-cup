import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'GameOptions';
const PLAYERS_TABLE = 'Players';
const GAME_RECORDS = 'GameRecords';
const PARTITION_KEY = 'currentChampion';
const API_URL = process.env.API_URL;

// Simple structured logger
function log(level, msg, extra = {}) {
  const base = { level, ts: new Date().toISOString(), ...extra };
  // Keep it single-line JSON for easy CloudWatch filtering
  console.log(JSON.stringify({ msg, ...base }));
}

async function getGameID() {
  const params = { TableName: TABLE_NAME, Key: { id: PARTITION_KEY } };
  try {
    const result = await dynamoDB.get(params).promise();
    return result.Item ? result.Item.gameID : null;
  } catch (error) {
    log('error', 'DynamoDB get (GameOptions) failed', { error: String(error) });
    throw new Error('Failed to retrieve game ID');
  }
}

// Fetch game data; return a normalized object with everything you need
async function fetchGameData(gameID) {
  const apiUrl = `${API_URL}/gamecenter/${gameID}/boxscore`;

  return new Promise((resolve, reject) => {
    const req = https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const gameData = JSON.parse(data);

          const homeTeam = gameData.homeTeam;
          const awayTeam = gameData.awayTeam;
          const gameState = gameData.gameState; // e.g., OFF, LIVE, FUT, FINAL (api dependent)
          const gameType = gameData.gameType; // include if the API provides it (2 = regular season on NHL stats)

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

    // Optional: safety timeout
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
    ConditionExpression: 'attribute_not_exists(id)', // prevent accidental overwrite
  };

  try {
    await dynamoDB.put(params).promise();
    log('info', 'Game record saved', { gameID, wTeam, wScore, lTeam, lScore });
  } catch (e) {
    // If already exists, log and proceed (idempotent behavior)
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

export const handler = async (event, context) => {
  log('info', 'Invocation start', {
    requestId: context?.awsRequestId,
    trigger: event?.source || 'manual/test',
    detailType: event?.detailType,
  });

  try {
    const gameID = await getGameID();
    if (!gameID) {
      log('info', 'No gameID in GameOptions; exiting early');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No game to check' }),
      };
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

    // If you truly need to filter by regular season only, keep this (assuming NHL: 2 = regular season)
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

    if (game.gameState !== 'OFF') {
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

    // Determine winner/loser
    const wTeam =
      game.homeScore > game.awayScore ? game.homeAbbrev : game.awayAbbrev;
    const lTeam =
      game.homeScore > game.awayScore ? game.awayAbbrev : game.homeAbbrev;
    const wScore = Math.max(game.homeScore, game.awayScore);
    const lScore = Math.min(game.homeScore, game.awayScore);
    log('info', 'Winner determined', { gameID, wTeam, wScore, lTeam, lScore });

    // Idempotency check
    const existing = await getSavedGame(gameID);
    if (existing) {
      log('info', 'Game already saved; skipping writes', { gameID });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Game already saved' }),
      };
    }

    await saveGameStats(gameID, wTeam, wScore, lTeam, lScore);
    await saveWinnerToDatabase(wTeam);

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
