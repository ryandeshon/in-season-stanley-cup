export function createSeason({
  GAME_RECORDS_TABLE,
  PLAYERS_TABLE,
  env,
  getQueryParams,
}) {
  function normalizeSeasonId(value) {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase();
    const seasonMatch = normalized.match(/^season(\d+)$/);
    if (seasonMatch) {
      const seasonNumber = Number(seasonMatch[1]);
      if (Number.isInteger(seasonNumber) && seasonNumber > 0) {
        return `season${seasonNumber}`;
      }
      return null;
    }
    const seasonNumber = Number(normalized);
    if (Number.isInteger(seasonNumber) && seasonNumber > 0) {
      return `season${seasonNumber}`;
    }
    return null;
  }

  function getSeasonNumber(seasonId) {
    const seasonMatch = String(seasonId || '').match(/^season(\d+)$/);
    if (!seasonMatch) return null;
    const seasonNumber = Number(seasonMatch[1]);
    return Number.isInteger(seasonNumber) && seasonNumber > 0
      ? seasonNumber
      : null;
  }

  function resolveSeasonTables(seasonId) {
    const seasonNumber = getSeasonNumber(seasonId) || 2;
    const playersTableOverride = env[`PLAYERS_TABLE_SEASON${seasonNumber}`];
    const gameRecordsTableOverride =
      env[`GAME_RECORDS_TABLE_SEASON${seasonNumber}`];

    return {
      players:
        playersTableOverride ||
        (seasonNumber === 2
          ? PLAYERS_TABLE
          : `${PLAYERS_TABLE}-Season${seasonNumber}`),
      gameRecords:
        gameRecordsTableOverride ||
        (seasonNumber === 2
          ? GAME_RECORDS_TABLE
          : `${GAME_RECORDS_TABLE}-Season${seasonNumber}`),
    };
  }

  function getSeasonContext(event) {
    const query = getQueryParams(event);
    const requestedSeasonRaw = query?.season;
    const requestedSeason = normalizeSeasonId(requestedSeasonRaw);
    const hasInvalidSeasonQuery =
      requestedSeasonRaw !== undefined &&
      requestedSeasonRaw !== null &&
      requestedSeasonRaw !== '' &&
      !requestedSeason;
    const defaultSeason = normalizeSeasonId(env.DEFAULT_SEASON) || 'season2';
    const seasonId = requestedSeason || defaultSeason;
    const tableConfig = resolveSeasonTables(seasonId);

    return {
      requestedSeason,
      hasInvalidSeasonQuery,
      seasonId,
      playersTable: tableConfig.players,
      gameRecordsTable: tableConfig.gameRecords,
    };
  }

  function parseBool(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
  }

  function getSeasonMeta(seasonId) {
    const envPrefix = seasonId.toUpperCase(); // e.g. SEASON2
    const regularSeasonEnd = env[`${envPrefix}_REGULAR_SEASON_END`] || null;
    const playoffsStart = env[`${envPrefix}_PLAYOFFS_START`] || null;
    const explicitSeasonOver = env[`${envPrefix}_SEASON_OVER`];

    const seasonOver =
      explicitSeasonOver !== undefined
        ? parseBool(explicitSeasonOver, false)
        : regularSeasonEnd
          ? Date.now() > new Date(`${regularSeasonEnd}T23:59:59Z`).getTime()
          : false;

    return {
      seasonId,
      seasonOver,
      regularSeasonEnd,
      playoffsStart,
    };
  }
  return {
    normalizeSeasonId,
    getSeasonNumber,
    resolveSeasonTables,
    getSeasonContext,
    parseBool,
    getSeasonMeta,
  };
}
