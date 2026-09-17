const { createConfig } = require('./config.cjs');
const {
  isFinished,
  getNextCheckDelaySeconds,
  schedulerAtExpression,
} = require('./check-game-logic.cjs');
const { createStateStore } = require('./state-store.cjs');
const { createFinalization } = require('./finalization.cjs');
const { createNhl } = require('./nhl.cjs');
const { createScheduler } = require('./scheduler.cjs');

function log(level, msg, extra = {}) {
  const base = { level, ts: new Date().toISOString(), ...extra };
  console.log(JSON.stringify({ msg, ...base }));
}
function addSecondsToNow(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
function createLegacyChecker({
  dynamoDB,
  https,
  scheduler = null,
  cloudFront = null,
  env = process.env,
  log: logger = log,
}) {
  const log = logger;
  const context = {
    ...createConfig(env),
    env,
    dynamoDB,
    https,
    scheduler,
    cloudFront,
    log,
    schedulerAtExpression,
  };
  Object.assign(context, createStateStore(context));
  Object.assign(context, createFinalization(context));
  Object.assign(context, createNhl(context));
  Object.assign(context, createScheduler(context));
  const {
    CHAMPION_FIELD,
    WATCH_STARTED_AT_FIELD,
    clearSelfSchedule,
    fetchGameData,
    finalizeGame,
    getActiveGameId,
    getGameOptions,
    invalidateApiCache,
    isWatchTooLong,
    resolveGameIdFromSchedule,
    setIdleState,
    updateWatchState,
    upsertSelfSchedule,
  } = context;
  const handler = async (event, context) => {
    log('info', 'Invocation start', {
      requestId: context?.awsRequestId,
      trigger: event?.source || 'manual/test',
      detailType: event?.detailType,
    });

    try {
      const gameOptions = await getGameOptions();
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
        log('info', 'Resolved gameID from schedule', {
          champion,
          gameID,
          date: resolved.date,
          decision: 'discovery_set_watch',
        });
      }
      log('info', 'GameID loaded', { gameID });

      const game = await fetchGameData(gameID);
      if (
        env.SEASON_STORAGE === 'v2' &&
        !String(gameID).startsWith(env.NHL_GAME_PREFIX)
      )
        throw new Error('Game belongs to another season');
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
      log('info', 'Winner determined', {
        gameID,
        wTeam,
        wScore,
        lTeam,
        lScore,
      });

      await finalizeGame({
        gameID,
        expectedChampion: champion,
        wTeam,
        wScore,
        lTeam,
        lScore,
      });
      await clearSelfSchedule(gameID, 'game_finalized');
      await invalidateApiCache(gameID, 'game_finalized');

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

  return handler;
}
function createChecker(deps) {
  const env = deps.env || process.env;
  if (env.SEASON_STORAGE !== 'v2') return createLegacyChecker(deps);
  const storage = require('../shared/season-storage.cjs');
  return async (event = {}, context) => {
    try {
      const catalog = await storage.loadCatalog(deps.dynamoDB, env);
      // Every trigger must name its season; delayed legacy triggers cannot switch seasons.
      const season = catalog.seasons.find((s) => s.id === event.seasonId);
      if (!season || season.status !== 'active' || !season.writersEnabled)
        return {
          statusCode: 423,
          body: JSON.stringify({
            error: 'An active, writable seasonId is required',
          }),
        };
      if (!/^\d{6}$/.test(season.nhlGamePrefix || ''))
        throw new Error('Missing NHL game prefix');
      return createLegacyChecker({
        ...deps,
        dynamoDB: storage.scopedClient(
          deps.dynamoDB,
          catalog.tables,
          season,
          'active'
        ),
        env: {
          ...env,
          CHECK_SEASON: season.id,
          NHL_GAME_PREFIX: season.nhlGamePrefix,
          GAME_OPTIONS_TABLE: catalog.tables.options,
          GAME_RECORDS_TABLE: catalog.tables.records,
          PLAYERS_TABLE: catalog.tables.players,
          WATCH_SCHEDULE_NAME: `${env.WATCH_SCHEDULE_NAME || 'inseason-check-game-watch'}-${season.id}`,
        },
      })(event, context);
    } catch (error) {
      (deps.log || log)('error', 'Season checker unavailable', {
        error: error.name,
      });
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Season checker unavailable' }),
      };
    }
  };
}
module.exports = { createChecker };
