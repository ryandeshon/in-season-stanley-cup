const https = require('https');
const AWS = require('aws-sdk');
const {
  isFinished,
  getNextCheckDelaySeconds,
  schedulerAtExpression,
} = require('./check-game-logic.cjs');

const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const cloudFront = new AWS.CloudFront({
  region: process.env.AWS_REGION || 'us-east-1',
});
const scheduler = AWS.Scheduler
  ? new AWS.Scheduler({
      region: process.env.AWS_REGION || 'us-east-1',
    })
  : null;

const TABLE_NAME = process.env.GAME_OPTIONS_TABLE || 'GameOptions';
const PLAYER_SEASON_TABLE = process.env.PLAYER_SEASON_TABLE || 'PlayerSeason';
const PLAYER_LIFETIME_TABLE = process.env.PLAYER_LIFETIME_TABLE || 'PlayerLifetime';
const GAME_RECORDS_V2_TABLE = process.env.GAME_RECORDS_V2_TABLE || 'GameRecordsV2';
const PARTITION_KEY = process.env.GAME_OPTIONS_KEY || 'currentChampion';
const GAME_ID_FIELD = process.env.GAME_ID_FIELD || 'gameID';
const ACTIVE_GAME_ID_FIELD = process.env.ACTIVE_GAME_ID_FIELD || 'activeGameId';
const CHAMPION_FIELD = process.env.CHAMPION_FIELD || 'champion';
const CHECK_STATUS_FIELD = process.env.CHECK_STATUS_FIELD || 'checkStatus';
const NEXT_CHECK_AT_FIELD = process.env.NEXT_CHECK_AT_FIELD || 'nextCheckAt';
const LAST_CHECKED_AT_FIELD = process.env.LAST_CHECKED_AT_FIELD || 'lastCheckedAt';
const FINALIZED_AT_FIELD = process.env.FINALIZED_AT_FIELD || 'finalizedAt';
const WATCH_STARTED_AT_FIELD = process.env.WATCH_STARTED_AT_FIELD || 'watchStartedAt';
const PROCESSED_GAME_ID_FIELD =
  process.env.PROCESSED_GAME_ID_FIELD || 'processedGameId';
const NHL_API_BASE =
  process.env.NHL_API_BASE || process.env.API_URL || 'https://api-web.nhle.com/v1';
const CHECK_STATUS = {
  IDLE: 'idle',
  WATCHING: 'watching',
  FINALIZED: 'finalized',
};
const SELF_SCHEDULING_ENABLED = process.env.SELF_SCHEDULING_ENABLED !== 'false';
const SCHEDULER_GROUP_NAME = process.env.SCHEDULER_GROUP_NAME || 'default';
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN || null;
const WATCH_SCHEDULE_NAME =
  process.env.WATCH_SCHEDULE_NAME ||
  `${(process.env.AWS_LAMBDA_FUNCTION_NAME || 'inseason-check-game').replace(/[^a-zA-Z0-9-_]/g, '-')}-watch`;
const API_CACHE_DISTRIBUTION_ID = process.env.API_CACHE_DISTRIBUTION_ID || null;
const API_CACHE_INVALIDATION_PATHS = (
  process.env.API_CACHE_INVALIDATION_PATHS || '/champion,/gameid,/check-status'
)
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean)
  .map((path) => (path.startsWith('/') ? path : `/${path}`));
const DEFAULT_SEASON = normalizeSeasonId(process.env.DEFAULT_SEASON) || 'season2';

function normalizeSeasonId(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  const seasonMatch = normalized.match(/^season(\d+)$/);
  if (seasonMatch) {
    const number = Number(seasonMatch[1]);
    if (Number.isInteger(number) && number > 0) {
      return `season${number}`;
    }
    return null;
  }
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `season${numeric}`;
  }
  return null;
}

function resolveSeasonId(gameOptions = {}) {
  return normalizeSeasonId(gameOptions.currentSeason) || DEFAULT_SEASON;
}

function log(level, msg, extra = {}) {
  const base = { level, ts: new Date().toISOString(), ...extra };
  console.log(JSON.stringify({ msg, ...base }));
}

function nowIso() {
  return new Date().toISOString();
}

function addSecondsToNow(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function getTargetArn(context) {
  return (
    process.env.CHECK_GAME_FUNCTION_ARN ||
    context?.invokedFunctionArn ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

function getActiveGameId(gameOptions) {
  return gameOptions?.[ACTIVE_GAME_ID_FIELD] ?? gameOptions?.[GAME_ID_FIELD] ?? null;
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
  const timestamp = nowIso();
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression:
      'SET #gid = :g, #activeGame = :g, #status = :watching, #watchStartedAt = if_not_exists(#watchStartedAt, :ts), updatedAt = :ts, #lastCheckedAt = :ts',
    ExpressionAttributeNames: {
      '#gid': GAME_ID_FIELD,
      '#activeGame': ACTIVE_GAME_ID_FIELD,
      '#status': CHECK_STATUS_FIELD,
      '#watchStartedAt': WATCH_STARTED_AT_FIELD,
      '#lastCheckedAt': LAST_CHECKED_AT_FIELD,
    },
    ExpressionAttributeValues: {
      ':g': gameID,
      ':watching': CHECK_STATUS.WATCHING,
      ':ts': timestamp,
    },
    ReturnValues: 'UPDATED_NEW',
  };
  const out = await dynamoDB.update(params).promise();
  return out?.Attributes?.[GAME_ID_FIELD] ?? gameID;
}

async function updateWatchState(gameID, nextCheckAt, decision) {
  const timestamp = nowIso();
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression:
      'SET #gid = :g, #activeGame = :g, #status = :watching, #watchStartedAt = if_not_exists(#watchStartedAt, :checked), #lastCheckedAt = :checked, #nextCheckAt = :nextCheck, updatedAt = :ts REMOVE #finalizedAt',
    ExpressionAttributeNames: {
      '#gid': GAME_ID_FIELD,
      '#activeGame': ACTIVE_GAME_ID_FIELD,
      '#status': CHECK_STATUS_FIELD,
      '#watchStartedAt': WATCH_STARTED_AT_FIELD,
      '#lastCheckedAt': LAST_CHECKED_AT_FIELD,
      '#nextCheckAt': NEXT_CHECK_AT_FIELD,
      '#finalizedAt': FINALIZED_AT_FIELD,
    },
    ExpressionAttributeValues: {
      ':g': gameID,
      ':watching': CHECK_STATUS.WATCHING,
      ':checked': timestamp,
      ':nextCheck': nextCheckAt,
      ':ts': timestamp,
    },
    ReturnValues: 'UPDATED_NEW',
  };
  const out = await dynamoDB.update(params).promise();
  log('info', 'Watch state updated', {
    gameID,
    decision,
    nextCheckAt,
    updated: out?.Attributes,
  });
}

async function setIdleState(decision) {
  const timestamp = nowIso();
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression:
      'SET #status = :idle, #lastCheckedAt = :checked, updatedAt = :ts REMOVE #activeGame, #gid, #nextCheckAt, #watchStartedAt',
    ExpressionAttributeNames: {
      '#status': CHECK_STATUS_FIELD,
      '#lastCheckedAt': LAST_CHECKED_AT_FIELD,
      '#activeGame': ACTIVE_GAME_ID_FIELD,
      '#gid': GAME_ID_FIELD,
      '#nextCheckAt': NEXT_CHECK_AT_FIELD,
      '#watchStartedAt': WATCH_STARTED_AT_FIELD,
    },
    ExpressionAttributeValues: {
      ':idle': CHECK_STATUS.IDLE,
      ':checked': timestamp,
      ':ts': timestamp,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  const out = await dynamoDB.update(params).promise();
  log('info', 'Set checker to idle', { decision, updated: out?.Attributes });
}

async function setFinalizedState(gameID, winner) {
  const timestamp = nowIso();
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression:
      'SET #champion = :winner, #status = :finalized, #lastCheckedAt = :checked, #finalizedAt = :finalizedAt, updatedAt = :ts REMOVE #activeGame, #gid, #nextCheckAt, #watchStartedAt',
    ExpressionAttributeNames: {
      '#champion': CHAMPION_FIELD,
      '#status': CHECK_STATUS_FIELD,
      '#lastCheckedAt': LAST_CHECKED_AT_FIELD,
      '#finalizedAt': FINALIZED_AT_FIELD,
      '#activeGame': ACTIVE_GAME_ID_FIELD,
      '#gid': GAME_ID_FIELD,
      '#nextCheckAt': NEXT_CHECK_AT_FIELD,
      '#watchStartedAt': WATCH_STARTED_AT_FIELD,
    },
    ExpressionAttributeValues: {
      ':winner': winner,
      ':finalized': CHECK_STATUS.FINALIZED,
      ':checked': timestamp,
      ':finalizedAt': timestamp,
      ':ts': timestamp,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  const out = await dynamoDB.update(params).promise();
  log('info', 'Champion updated and watch finalized', {
    gameID,
    winner,
    updated: out?.Attributes,
  });
}

async function tryClaimProcessedGame(gameID) {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression: 'SET #processedGameId = :gameID, updatedAt = :ts',
    ConditionExpression:
      'attribute_not_exists(#processedGameId) OR #processedGameId <> :gameID',
    ExpressionAttributeNames: {
      '#processedGameId': PROCESSED_GAME_ID_FIELD,
    },
    ExpressionAttributeValues: {
      ':gameID': gameID,
      ':ts': nowIso(),
    },
    ReturnValues: 'UPDATED_NEW',
  };

  try {
    const out = await dynamoDB.update(params).promise();
    log('info', 'Claimed processedGameId token', {
      gameID,
      updated: out?.Attributes,
      writeOutcome: 'claimed',
    });
    return true;
  } catch (error) {
    if (error?.code === 'ConditionalCheckFailedException') {
      log('info', 'processedGameId already claimed; skipping duplicate writes', {
        gameID,
        writeOutcome: 'duplicate',
      });
      return false;
    }
    throw error;
  }
}

async function releaseProcessedGameClaim(gameID) {
  const params = {
    TableName: TABLE_NAME,
    Key: { id: PARTITION_KEY },
    UpdateExpression: 'REMOVE #processedGameId',
    ConditionExpression: '#processedGameId = :gameID',
    ExpressionAttributeNames: {
      '#processedGameId': PROCESSED_GAME_ID_FIELD,
    },
    ExpressionAttributeValues: {
      ':gameID': gameID,
    },
  };

  try {
    await dynamoDB.update(params).promise();
    log('info', 'Released processedGameId token after error', { gameID });
  } catch (error) {
    if (error?.code === 'ConditionalCheckFailedException') return;
    log('error', 'Failed to release processedGameId token', {
      gameID,
      error: String(error),
    });
  }
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

async function listSeasonPlayers(seasonId) {
  const players = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamoDB
      .query({
        TableName: PLAYER_SEASON_TABLE,
        KeyConditionExpression: '#seasonId = :seasonId',
        ExpressionAttributeNames: {
          '#seasonId': 'seasonId',
        },
        ExpressionAttributeValues: {
          ':seasonId': seasonId,
        },
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
      })
      .promise();
    players.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return players;
}

async function findPlayerWithTeam(team, seasonId) {
  try {
    const players = await listSeasonPlayers(seasonId);
    const player = players.find(
      (candidate) => Array.isArray(candidate.teams) && candidate.teams.includes(team)
    );
    if (!player) return null;
    return {
      playerId: player.playerId,
      name: player.name || null,
    };
  } catch (error) {
    log('error', 'PlayerSeason query failed', {
      error: String(error),
      seasonId,
      team,
    });
    throw new Error('Failed to find player with winning team');
  }
}

async function incrementDefenses(playerId, team, seasonId, playerName = null) {
  const timestamp = nowIso();
  const [seasonUpdate, lifetimeUpdate] = await Promise.all([
    dynamoDB
      .update({
        TableName: PLAYER_SEASON_TABLE,
        Key: { seasonId, playerId },
        UpdateExpression:
          'SET #name = if_not_exists(#name, :name), teams = if_not_exists(teams, :emptyTeams), titleDefenses = if_not_exists(titleDefenses, :zero) + :inc, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#name': 'name',
        },
        ExpressionAttributeValues: {
          ':name': playerName || String(playerId),
          ':emptyTeams': [],
          ':inc': 1,
          ':zero': 0,
          ':updatedAt': timestamp,
        },
        ReturnValues: 'UPDATED_NEW',
      })
      .promise(),
    dynamoDB
      .update({
        TableName: PLAYER_LIFETIME_TABLE,
        Key: { playerId },
        UpdateExpression:
          'SET #name = if_not_exists(#name, :name), totalDefenses = if_not_exists(totalDefenses, :zero) + :inc, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#name': 'name',
        },
        ExpressionAttributeValues: {
          ':name': playerName || String(playerId),
          ':inc': 1,
          ':zero': 0,
          ':updatedAt': timestamp,
        },
        ReturnValues: 'UPDATED_NEW',
      })
      .promise(),
  ]);

  log('info', 'Player defenses incremented', {
    playerId,
    team,
    seasonId,
    seasonUpdated: seasonUpdate?.Attributes,
    lifetimeUpdated: lifetimeUpdate?.Attributes,
  });
}

async function saveGameStats(seasonId, gameID, wTeam, wScore, lTeam, lScore) {
  const normalizedGameId = String(gameID);
  const timestamp = nowIso();
  const params = {
    TableName: GAME_RECORDS_V2_TABLE,
    Item: {
      seasonId,
      gameId: normalizedGameId,
      id: normalizedGameId,
      wTeam,
      wScore,
      lTeam,
      lScore,
      savedAt: timestamp,
      updatedAt: timestamp,
    },
    ConditionExpression:
      'attribute_not_exists(#seasonId) AND attribute_not_exists(#gameId)',
    ExpressionAttributeNames: {
      '#seasonId': 'seasonId',
      '#gameId': 'gameId',
    },
  };

  try {
    await dynamoDB.put(params).promise();
    log('info', 'Game record saved', {
      seasonId,
      gameID: normalizedGameId,
      wTeam,
      wScore,
      lTeam,
      lScore,
    });
    return true;
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      log('info', 'Game record already exists, skipping save', {
        seasonId,
        gameID: normalizedGameId,
      });
      return false;
    }
    throw error;
  }
}

function isWatchTooLong(gameOptions, maxMs = 8 * 60 * 60 * 1000) {
  const startedAt = gameOptions?.[WATCH_STARTED_AT_FIELD];
  if (!startedAt) return false;
  const parsed = Date.parse(startedAt);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed > maxMs;
}

async function upsertSelfSchedule(nextCheckAt, gameID, reason, context) {
  const targetArn = getTargetArn(context);
  if (!SELF_SCHEDULING_ENABLED) {
    log('info', 'Self scheduling disabled; skipping schedule update', {
      gameID,
      reason,
      decision: 'schedule_skipped_disabled',
      nextCheckAt,
    });
    return;
  }
  if (!scheduler) {
    log('info', 'AWS Scheduler SDK unavailable; skipping schedule update', {
      gameID,
      reason,
      decision: 'schedule_skipped_no_sdk',
      nextCheckAt,
    });
    return;
  }
  if (!SCHEDULER_ROLE_ARN || !targetArn) {
    log('info', 'Scheduler role/function ARN missing; skipping schedule update', {
      gameID,
      reason,
      decision: 'schedule_skipped_missing_config',
      nextCheckAt,
    });
    return;
  }

  const baseParams = {
    Name: WATCH_SCHEDULE_NAME,
    GroupName: SCHEDULER_GROUP_NAME,
    ScheduleExpression: schedulerAtExpression(nextCheckAt),
    FlexibleTimeWindow: { Mode: 'OFF' },
    ActionAfterCompletion: 'DELETE',
    Target: {
      Arn: targetArn,
      RoleArn: SCHEDULER_ROLE_ARN,
      Input: JSON.stringify({
        source: 'inseason.self-schedule',
        reason,
        gameID,
        nextCheckAt,
      }),
      RetryPolicy: {
        MaximumEventAgeInSeconds: 3600,
        MaximumRetryAttempts: 2,
      },
    },
  };

  try {
    await scheduler.createSchedule(baseParams).promise();
    log('info', 'Created self schedule', {
      gameID,
      reason,
      nextCheckAt,
      scheduleName: WATCH_SCHEDULE_NAME,
      decision: 'schedule_created',
    });
  } catch (error) {
    if (error?.code !== 'ConflictException') throw error;
    await scheduler.updateSchedule(baseParams).promise();
    log('info', 'Updated self schedule', {
      gameID,
      reason,
      nextCheckAt,
      scheduleName: WATCH_SCHEDULE_NAME,
      decision: 'schedule_updated',
    });
  }
}

async function clearSelfSchedule(gameID, reason) {
  if (!SELF_SCHEDULING_ENABLED || !scheduler) return;

  try {
    await scheduler
      .deleteSchedule({
        Name: WATCH_SCHEDULE_NAME,
        GroupName: SCHEDULER_GROUP_NAME,
      })
      .promise();
    log('info', 'Deleted self schedule', {
      gameID,
      reason,
      scheduleName: WATCH_SCHEDULE_NAME,
      decision: 'schedule_deleted',
    });
  } catch (error) {
    if (error?.code === 'ResourceNotFoundException') return;
    log('error', 'Failed to delete self schedule', {
      gameID,
      reason,
      error: String(error),
    });
  }
}

async function invalidateApiCache(gameID, reason) {
  if (!API_CACHE_DISTRIBUTION_ID) {
    log('info', 'API cache distribution not configured; skipping invalidation', {
      gameID,
      reason,
      decision: 'cache_invalidation_skipped_missing_distribution',
    });
    return;
  }

  const paths = API_CACHE_INVALIDATION_PATHS.length
    ? API_CACHE_INVALIDATION_PATHS
    : ['/champion', '/gameid'];

  const callerReference = `check-game-${gameID}-${Date.now()}`;
  const params = {
    DistributionId: API_CACHE_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: callerReference,
      Paths: {
        Quantity: paths.length,
        Items: paths,
      },
    },
  };

  try {
    const result = await cloudFront.createInvalidation(params).promise();
    log('info', 'Requested API cache invalidation', {
      gameID,
      reason,
      distributionId: API_CACHE_DISTRIBUTION_ID,
      paths,
      invalidationId: result?.Invalidation?.Id,
      status: result?.Invalidation?.Status,
      decision: 'cache_invalidation_requested',
    });
  } catch (error) {
    log('error', 'Failed API cache invalidation request', {
      gameID,
      reason,
      distributionId: API_CACHE_DISTRIBUTION_ID,
      paths,
      error: String(error),
    });
  }
}

const handler = async (event, context) => {
  log('info', 'Invocation start', {
    requestId: context?.awsRequestId,
    trigger: event?.source || 'manual/test',
    detailType: event?.detailType,
  });

  try {
    const gameOptions = await getGameOptions();
    const seasonId = resolveSeasonId(gameOptions);
    const champion = gameOptions?.[CHAMPION_FIELD] ?? null;
    if (!champion) {
      log('info', 'No champion set in GameOptions; exiting early');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No champion to check' }),
      };
    }

    let gameID = getActiveGameId(gameOptions);

    if (!gameID) {
      const resolved = await resolveGameIdFromSchedule(champion);
      if (!resolved?.gameID) {
        log('info', 'No champion game found in schedule; exiting early', {
          champion,
          decision: 'no_game_found',
        });
        await setIdleState('no_champion_game');
        await clearSelfSchedule(null, 'no_champion_game');
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
        decision: 'discovery_set_watch',
      });
    }
    log('info', 'GameID loaded', { gameID, seasonId });

    const game = await fetchGameData(gameID);
    log('info', 'Game state fetched', {
      gameID,
      gameState: game.gameState,
      gameType: game.gameType,
      matchup: `${game.homeAbbrev} vs ${game.awayAbbrev}`,
      score: `${game.homeScore}-${game.awayScore}`,
      state: game.gameState,
    });

    if (isWatchTooLong(gameOptions)) {
      log('info', 'Watch loop exceeded expected duration', {
        gameID,
        watchStartedAt: gameOptions?.[WATCH_STARTED_AT_FIELD],
        decision: 'watching_too_long',
      });
    }

    if (typeof game.gameType !== 'undefined' && game.gameType !== 2) {
      log('info', 'Non-regular-season game; skipping', {
        gameType: game.gameType,
        gameID,
        decision: 'non_regular_season',
      });
      await setIdleState('non_regular_season');
      await clearSelfSchedule(gameID, 'non_regular_season');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Not a regular season game' }),
      };
    }

    if (!isFinished(game.gameState)) {
      const delaySeconds = getNextCheckDelaySeconds(game.gameState);
      const nextCheckAt = addSecondsToNow(delaySeconds);
      await updateWatchState(gameID, nextCheckAt, 'game_not_finished');
      await upsertSelfSchedule(
        nextCheckAt,
        gameID,
        `state_${String(game.gameState).toLowerCase()}`,
        context
      );
      log('info', 'Game not finished yet', {
        gameID,
        gameState: game.gameState,
        nextCheckAt,
        decision: 'reschedule',
      });
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Game ${gameID} not finished (${game.gameState})`,
          nextCheckAt,
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

    const canWrite = await tryClaimProcessedGame(gameID);
    if (!canWrite) {
      await setFinalizedState(gameID, wTeam);
      await clearSelfSchedule(gameID, 'duplicate_finalization');
      await invalidateApiCache(gameID, 'duplicate_finalization');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Game already processed', gameID }),
      };
    }

    try {
      const didSaveGameRecord = await saveGameStats(
        seasonId,
        gameID,
        wTeam,
        wScore,
        lTeam,
        lScore
      );
      await setFinalizedState(gameID, wTeam);
      await clearSelfSchedule(gameID, 'game_finalized');
      await invalidateApiCache(gameID, 'game_finalized');

      if (didSaveGameRecord) {
        const winnerPlayer = await findPlayerWithTeam(wTeam, seasonId);
        if (winnerPlayer?.playerId !== undefined && winnerPlayer?.playerId !== null) {
          await incrementDefenses(
            winnerPlayer.playerId,
            wTeam,
            seasonId,
            winnerPlayer.name
          );
        } else {
          log('info', 'No player found for winning team', { wTeam, seasonId });
        }
      } else {
        log('info', 'Skipping defense increment due existing game record', {
          gameID,
          seasonId,
          writeOutcome: 'record_exists',
        });
      }
    } catch (error) {
      await releaseProcessedGameClaim(gameID);
      throw error;
    }

    log('info', 'Invocation complete', { gameID, seasonId, champion: wTeam });
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

module.exports = {
  handler,
  __test: {
    isFinished,
    getNextCheckDelaySeconds,
    schedulerAtExpression,
  },
};
