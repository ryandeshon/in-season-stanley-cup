import { createConfig } from './config.js';
import {
  DraftStateValidationError,
  DraftStateConflictError,
} from './errors.js';
import { createHttp } from './http.js';
import { createSeason } from './season.js';
import { createDraftRules } from './draft-rules.js';
import { createRepository } from './repository.js';
import { createSchedule } from './schedule.js';
import { createDraftService } from './draft-service.js';

export function createHttpHandler({ dynamoDB, https, env = process.env }) {
  const context = {
    ...createConfig(env),
    env,
    dynamoDB,
    https,
    DraftStateValidationError,
    DraftStateConflictError,
  };
  Object.assign(context, createHttp(context));
  Object.assign(context, createSeason(context));
  Object.assign(context, createDraftRules(context));
  Object.assign(context, createRepository(context));
  Object.assign(context, createSchedule(context));
  Object.assign(context, createDraftService(context));
  const {
    CACHE_TTLS,
    NHL_API_BASE,
    coerceId,
    ensureDraftState,
    fetchSchedule,
    findChampionGame,
    getGameOptions,
    getMethod,
    getPlayerByName,
    getQueryParams,
    getSeasonContext,
    getSeasonMeta,
    getToday,
    isAuthorized,
    listChampionHistory,
    listGameRecords,
    listPlayers,
    makeDraftPick,
    normalizePath,
    parseBody,
    parseHistoryLimit,
    resetTeams,
    response,
    setGameId,
    undoLastDraftPick,
    updateDraftState,
    updatePlayerTeams,
  } = context;
  const handler = async (event) => {
    const path = normalizePath(event);
    const method = getMethod(event);
    const seasonContext = getSeasonContext(event);

    if (method === 'OPTIONS') return response(event, 204, {});

    try {
      if (seasonContext.hasInvalidSeasonQuery) {
        return response(event, 400, {
          error:
            'Invalid season query parameter. Use seasonN or N (for example season2 or 2).',
        });
      }

      // ---- Players ----
      if (path === '/players' && method === 'GET') {
        return response(
          event,
          200,
          await listPlayers(seasonContext.playersTable),
          {
            ttlSeconds: CACHE_TTLS.roster,
            staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateLong,
            staleIfError: CACHE_TTLS.staleIfError,
          }
        );
      }

      if (path.startsWith('/players/') && method === 'GET') {
        const name = decodeURIComponent(path.split('/').pop());
        return response(
          event,
          200,
          await getPlayerByName(name, seasonContext.playersTable)
        );
      }

      if (path === '/players/reset-teams' && method === 'POST') {
        if (!isAuthorized(event)) {
          return response(event, 401, { error: 'Unauthorized' });
        }
        await resetTeams(seasonContext.playersTable);
        return response(event, 200, { ok: true });
      }

      const teamPatchMatch = path.match(/^\/players\/([^/]+)\/teams$/);
      if (teamPatchMatch && method === 'PATCH') {
        if (!isAuthorized(event)) {
          return response(event, 401, { error: 'Unauthorized' });
        }
        const body = parseBody(event.body);
        const team = body?.team;
        const action = body?.action || 'add';
        if (!team) return response(event, 400, { error: 'team is required' });
        const playerId = coerceId(teamPatchMatch[1]);
        const updated = await updatePlayerTeams(
          playerId,
          team,
          action,
          seasonContext.playersTable
        );
        return response(event, 200, updated);
      }

      // ---- Game records ----
      if (path === '/game-records' && method === 'GET') {
        return response(
          event,
          200,
          await listGameRecords(seasonContext.gameRecordsTable),
          {
            ttlSeconds: CACHE_TTLS.gameRecords,
            staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
            staleIfError: CACHE_TTLS.staleIfError,
          }
        );
      }

      if (path === '/champion/history' && method === 'GET') {
        const query = getQueryParams(event);
        const limit = parseHistoryLimit(query?.limit);
        if (limit === null) {
          return response(event, 400, {
            error: 'limit must be a positive integer',
          });
        }

        const history = await listChampionHistory(
          limit,
          seasonContext.gameRecordsTable
        );
        return response(
          event,
          200,
          {
            seasonId: seasonContext.seasonId,
            limit,
            history,
          },
          {
            ttlSeconds: CACHE_TTLS.gameRecords,
            staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
            staleIfError: CACHE_TTLS.staleIfError,
          }
        );
      }

      // ---- Champion + game id ----
      if (path === '/champion' && method === 'GET') {
        const opts = await getGameOptions();
        const champion = opts.champion;
        if (!champion) {
          return response(event, 404, {
            error: 'Champion not set in GameOptions',
          });
        }

        let gameID = opts.activeGameId ?? opts.gameID ?? null;
        let cacheOptions = {
          ttlSeconds: CACHE_TTLS.playingDay,
          staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
          staleIfError: CACHE_TTLS.staleIfError,
        };
        if (NHL_API_BASE) {
          try {
            const today = getToday();
            const schedule = await fetchSchedule(today);
            const found = findChampionGame(schedule, champion, today);
            gameID = found || null;
            await setGameId(gameID);
            cacheOptions =
              found === null
                ? {
                    ttlSeconds: CACHE_TTLS.nonPlayingDay,
                    staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateLong,
                    staleIfError: CACHE_TTLS.staleIfError,
                  }
                : {
                    ttlSeconds: CACHE_TTLS.playingDay,
                    staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
                    staleIfError: CACHE_TTLS.staleIfError,
                  };
          } catch (err) {
            console.error('schedule lookup failed', err);
          }
        }

        return response(
          event,
          200,
          {
            champion,
            gameID,
            activeGameId: gameID,
            seasonId: seasonContext.seasonId,
          },
          cacheOptions
        );
      }

      if (path === '/gameid' && method === 'GET') {
        const opts = await getGameOptions();
        const activeGameId = opts.activeGameId ?? opts.gameID ?? null;
        const hasActiveGame = Boolean(activeGameId);
        return response(
          event,
          200,
          {
            gameID: activeGameId,
            activeGameId,
            seasonId: seasonContext.seasonId,
          },
          hasActiveGame
            ? {
                ttlSeconds: CACHE_TTLS.playingDay,
                staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
                staleIfError: CACHE_TTLS.staleIfError,
              }
            : {
                ttlSeconds: CACHE_TTLS.nonPlayingDay,
                staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateLong,
                staleIfError: CACHE_TTLS.staleIfError,
              }
        );
      }

      if (path === '/check-status' && method === 'GET') {
        const opts = await getGameOptions();
        return response(event, 200, {
          seasonId: seasonContext.seasonId,
          champion: opts.champion ?? null,
          gameID: opts.activeGameId ?? opts.gameID ?? null,
          activeGameId: opts.activeGameId ?? null,
          checkStatus: opts.checkStatus ?? null,
          nextCheckAt: opts.nextCheckAt ?? null,
          lastCheckedAt: opts.lastCheckedAt ?? null,
          finalizedAt: opts.finalizedAt ?? null,
          processedGameId: opts.processedGameId ?? null,
        });
      }

      if (path === '/season/meta' && method === 'GET') {
        return response(event, 200, getSeasonMeta(seasonContext.seasonId), {
          ttlSeconds: CACHE_TTLS.nonPlayingDay,
          staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateLong,
          staleIfError: CACHE_TTLS.staleIfError,
        });
      }

      // ---- Draft ----
      if (path === '/draft/state' && method === 'GET') {
        const state = await ensureDraftState();
        return response(event, 200, state);
      }

      if (path === '/draft/state' && method === 'PATCH') {
        if (!isAuthorized(event)) {
          return response(event, 401, { error: 'Unauthorized' });
        }
        const patch = parseBody(event.body);
        try {
          const state = await updateDraftState(patch);
          return response(event, 200, state);
        } catch (error) {
          if (error instanceof DraftStateValidationError) {
            return response(event, 400, { error: error.message });
          }
          if (error instanceof DraftStateConflictError) {
            return response(event, 409, {
              error: error.message,
              currentVersion: error.currentState?.version ?? null,
              currentState: error.currentState ?? null,
            });
          }
          throw error;
        }
      }

      if (path === '/draft/pick' && method === 'POST') {
        const { playerId, team, version } = parseBody(event.body);
        if (playerId === undefined || playerId === null || playerId === '') {
          return response(event, 400, { error: 'playerId is required' });
        }
        if (!team) {
          return response(event, 400, { error: 'team is required' });
        }
        if (version === undefined) {
          return response(event, 400, { error: 'version is required' });
        }

        try {
          const result = await makeDraftPick({
            playerId,
            team,
            version,
            playersTable: seasonContext.playersTable,
          });
          return response(event, 200, result);
        } catch (error) {
          if (error instanceof DraftStateValidationError) {
            return response(event, 400, { error: error.message });
          }
          if (error instanceof DraftStateConflictError) {
            return response(event, 409, {
              error: error.message,
              currentVersion: error.currentState?.version ?? null,
              currentState: error.currentState ?? null,
            });
          }
          throw error;
        }
      }

      if (path === '/draft/undo-last-pick' && method === 'POST') {
        if (!isAuthorized(event)) {
          return response(event, 401, { error: 'Unauthorized' });
        }

        const { version } = parseBody(event.body);
        if (version === undefined) {
          return response(event, 400, { error: 'version is required' });
        }

        try {
          const result = await undoLastDraftPick({
            version,
            playersTable: seasonContext.playersTable,
          });
          return response(event, 200, result);
        } catch (error) {
          if (error instanceof DraftStateValidationError) {
            return response(event, 400, { error: error.message });
          }
          if (error instanceof DraftStateConflictError) {
            return response(event, 409, {
              error: error.message,
              currentVersion: error.currentState?.version ?? null,
              currentState: error.currentState ?? null,
            });
          }
          throw error;
        }
      }

      if (path === '/draft/select-team' && method === 'POST') {
        if (!isAuthorized(event)) {
          return response(event, 401, { error: 'Unauthorized' });
        }
        const { playerId, team } = parseBody(event.body);
        if (!playerId || !team) {
          return response(event, 400, {
            error: 'playerId and team are required',
          });
        }
        const state = await ensureDraftState();
        if (state.isLocked) {
          return response(event, 409, {
            error: 'Draft is locked',
            currentVersion: state.version,
            currentState: state,
          });
        }
        const updated = await updatePlayerTeams(
          coerceId(playerId),
          team,
          'add',
          seasonContext.playersTable
        );
        return response(event, 200, { player: updated, team });
      }

      return response(event, 404, { error: 'Not found', path, method });
    } catch (err) {
      console.error('handler error', err);
      return response(event, 500, {
        error: 'Internal Server Error',
        detail: String(err),
      });
    }
  };

  return handler;
}
