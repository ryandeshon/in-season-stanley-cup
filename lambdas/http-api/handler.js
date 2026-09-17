import storage from '../shared/season-storage.cjs';
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

function createLegacyHandler({
  dynamoDB,
  https,
  env = process.env,
  season = null,
}) {
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
    getSeasonMeta: legacySeasonMeta,
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
    resetDraft,
    response,
    undoLastDraftPick,
    updateDraftState,
    updatePlayerTeams,
  } = context;
  const getSeasonMeta = (id) =>
    season
      ? {
          ...season,
          seasonId: season.id,
          seasonOver: season.status === 'archived',
        }
      : legacySeasonMeta(id);
  const handler = async (event) => {
    const path = normalizePath(event);
    const method = getMethod(event);
    const seasonContext = getSeasonContext(event);

    if (method === 'OPTIONS') return response(event, 204, {});
    async function readSeasonOptions() {
      if (
        !season &&
        seasonContext.seasonId !== (env.DEFAULT_SEASON || 'season2')
      ) {
        const records = await listGameRecords(seasonContext.gameRecordsTable);
        const latest = records.sort((a, b) => Number(b.id) - Number(a.id))[0];
        return {
          champion: latest?.wTeam || null,
          checkStatus: 'archived',
          processedGameId: latest?.id || null,
        };
      }
      const opts = await getGameOptions();
      if (season && season.status !== 'active')
        return {
          ...opts,
          gameID: null,
          activeGameId: null,
          nextCheckAt: null,
          checkStatus: season.status,
        };
      return opts;
    }

    try {
      if (seasonContext.hasInvalidSeasonQuery) {
        return response(event, 400, {
          error:
            'Invalid season query parameter. Use seasonN or N (for example season2 or 2).',
        });
      }

      if (path === '/seasons' && method === 'GET') {
        return response(event, 200, {
          defaultSeason: env.DEFAULT_SEASON || 'season2',
          seasons: ['season1', 'season2'].map((id) => ({
            ...getSeasonMeta(id),
            id,
            label: `Season ${id.slice(6)}`,
            status:
              id === 'season1' || getSeasonMeta(id).seasonOver
                ? 'archived'
                : 'active',
          })),
        });
      }
      if (
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) &&
        (season
          ? season.status !== 'preseason' || !season.writersEnabled
          : seasonContext.seasonId !== (env.DEFAULT_SEASON || 'season2') ||
            getSeasonMeta(seasonContext.seasonId).seasonOver)
      ) {
        return response(event, 423, { error: 'This season is read-only' });
      }
      // ---- Players ----
      if (path === '/players' && method === 'GET') {
        return response(
          event,
          200,
          await listPlayers(seasonContext.playersTable),
          {
            ttlSeconds: season?.status === 'preseason' ? 0 : CACHE_TTLS.roster,
            staleWhileRevalidate:
              season?.status === 'preseason'
                ? 0
                : CACHE_TTLS.staleWhileRevalidateLong,
            staleIfError:
              season?.status === 'preseason' ? 0 : CACHE_TTLS.staleIfError,
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
        if (season) {
          const result = await resetDraft({
            version: parseBody(event.body).version,
            playersTable: seasonContext.playersTable,
          });
          return response(event, 200, result);
        }
        await resetTeams(seasonContext.playersTable);
        return response(event, 200, { ok: true });
      }

      if (
        season &&
        (path === '/draft/select-team' ||
          (path.startsWith('/players/') &&
            method !== 'GET' &&
            path !== '/players/reset-teams'))
      ) {
        return response(event, 409, {
          error: 'Use the versioned draft endpoints to change rosters',
        });
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
        const opts = await readSeasonOptions();
        const champion = opts.champion;
        if (!champion && season?.status !== 'preseason') {
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
        if (
          NHL_API_BASE &&
          champion &&
          (season
            ? season.status === 'active'
            : !getSeasonMeta(seasonContext.seasonId).seasonOver) &&
          seasonContext.seasonId === (env.DEFAULT_SEASON || 'season2')
        ) {
          try {
            const today = getToday();
            const schedule = await fetchSchedule(today);
            const found = findChampionGame(schedule, champion, today);
            gameID = found || null;
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
        const opts = await readSeasonOptions();
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
        const opts = await readSeasonOptions();
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

      if (path === '/season/meta' && method === 'GET')
        return response(event, 200, getSeasonMeta(seasonContext.seasonId));

      // ---- Draft ----
      if (path === '/draft/state' && method === 'GET') {
        if (
          !season &&
          seasonContext.seasonId !== (env.DEFAULT_SEASON || 'season2')
        )
          return response(event, 200, {
            version: 0,
            draftStarted: false,
            isLocked: true,
            availableTeams: [],
            pickHistory: [],
            historyAvailability: 'legacy-history-unavailable',
          });
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
      if (err instanceof DraftStateValidationError)
        return response(event, 400, { error: err.message });
      if (err instanceof DraftStateConflictError)
        return response(event, 409, {
          error: err.message,
          currentState: err.currentState,
        });
      if (err.code === 'SeasonWriteLocked')
        return response(event, 423, { error: 'Season writes are disabled' });
      console.error('handler error', err);
      return response(event, 500, {
        error: 'Internal Server Error',
      });
    }
  };

  return handler;
}

export function createHttpHandler({ dynamoDB, https, env = process.env }) {
  if (env.SEASON_STORAGE !== 'v2')
    return createLegacyHandler({ dynamoDB, https, env });
  const http = createHttp({ ...createConfig(env), env });
  return async (event) => {
    if (http.getMethod(event) === 'OPTIONS')
      return http.response(event, 204, {});
    try {
      const catalog = await storage.loadCatalog(dynamoDB, env);
      if (
        http.normalizePath(event) === '/seasons' &&
        http.getMethod(event) === 'GET'
      ) {
        return http.response(event, 200, {
          storageVersion: 'v2',
          defaultSeason: catalog.defaultSeason,
          seasons: catalog.seasons.map((s) => ({
            ...s,
            seasonId: s.id,
            seasonOver: s.status === 'archived',
          })),
        });
      }
      const raw = http.getQueryParams(event).season ?? catalog.defaultSeason;
      const match = String(raw)
        .trim()
        .toLowerCase()
        .match(/^(?:season)?([1-9]\d*)$/);
      if (!match) return http.response(event, 400, { error: 'Invalid season' });
      const id = `season${match[1]}`;
      const season = catalog.seasons.find((s) => s.id === id);
      if (!season)
        return http.response(event, 404, { error: 'Unknown season' });
      const scoped = storage.scopedClient(
        dynamoDB,
        catalog.tables,
        season,
        'preseason'
      );
      const overrides = {
        ...env,
        DEFAULT_SEASON: id,
        PLAYERS_TABLE: catalog.tables.players,
        GAME_RECORDS_TABLE: catalog.tables.records,
        GAME_OPTIONS_TABLE: catalog.tables.options,
        [`PLAYERS_TABLE_${id.toUpperCase()}`]: catalog.tables.players,
        [`GAME_RECORDS_TABLE_${id.toUpperCase()}`]: catalog.tables.records,
      };
      return await createLegacyHandler({
        dynamoDB: scoped,
        https,
        env: overrides,
        season,
      })(event);
    } catch (error) {
      console.error('season request failed', error.name);
      return http.response(event, 503, { error: 'Season data is unavailable' });
    }
  };
}
