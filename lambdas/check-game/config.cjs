function createConfig(env) {
  const TABLE_NAME = env.GAME_OPTIONS_TABLE || 'GameOptions';
  const PLAYERS_TABLE = env.PLAYERS_TABLE || 'Players';
  const GAME_RECORDS = env.GAME_RECORDS_TABLE || 'GameRecords';
  const PARTITION_KEY = env.GAME_OPTIONS_KEY || 'currentChampion';
  const GAME_ID_FIELD = env.GAME_ID_FIELD || 'gameID';
  const ACTIVE_GAME_ID_FIELD = env.ACTIVE_GAME_ID_FIELD || 'activeGameId';
  const CHAMPION_FIELD = env.CHAMPION_FIELD || 'champion';
  const CHECK_STATUS_FIELD = env.CHECK_STATUS_FIELD || 'checkStatus';
  const NEXT_CHECK_AT_FIELD = env.NEXT_CHECK_AT_FIELD || 'nextCheckAt';
  const LAST_CHECKED_AT_FIELD = env.LAST_CHECKED_AT_FIELD || 'lastCheckedAt';
  const FINALIZED_AT_FIELD = env.FINALIZED_AT_FIELD || 'finalizedAt';
  const WATCH_STARTED_AT_FIELD = env.WATCH_STARTED_AT_FIELD || 'watchStartedAt';
  const PROCESSED_GAME_ID_FIELD =
    env.PROCESSED_GAME_ID_FIELD || 'processedGameId';
  const NHL_API_BASE =
    env.NHL_API_BASE || env.API_URL || 'https://api-web.nhle.com/v1';
  const CHECK_STATUS = {
    IDLE: 'idle',
    WATCHING: 'watching',
    FINALIZED: 'finalized',
  };
  const SELF_SCHEDULING_ENABLED = env.SELF_SCHEDULING_ENABLED !== 'false';
  const SCHEDULER_GROUP_NAME = env.SCHEDULER_GROUP_NAME || 'default';
  const SCHEDULER_ROLE_ARN = env.SCHEDULER_ROLE_ARN || null;
  const WATCH_SCHEDULE_NAME =
    env.WATCH_SCHEDULE_NAME ||
    `${(env.AWS_LAMBDA_FUNCTION_NAME || 'inseason-check-game').replace(/[^a-zA-Z0-9-_]/g, '-')}-watch`;
  const API_CACHE_DISTRIBUTION_ID = env.API_CACHE_DISTRIBUTION_ID || null;
  const API_CACHE_INVALIDATION_PATHS = (
    env.API_CACHE_INVALIDATION_PATHS || '/champion,/gameid,/check-status'
  )
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => (path.startsWith('/') ? path : `/${path}`));

  return {
    TABLE_NAME,
    PLAYERS_TABLE,
    GAME_RECORDS,
    PARTITION_KEY,
    GAME_ID_FIELD,
    ACTIVE_GAME_ID_FIELD,
    CHAMPION_FIELD,
    CHECK_STATUS_FIELD,
    NEXT_CHECK_AT_FIELD,
    LAST_CHECKED_AT_FIELD,
    FINALIZED_AT_FIELD,
    WATCH_STARTED_AT_FIELD,
    PROCESSED_GAME_ID_FIELD,
    NHL_API_BASE,
    CHECK_STATUS,
    SELF_SCHEDULING_ENABLED,
    SCHEDULER_GROUP_NAME,
    SCHEDULER_ROLE_ARN,
    WATCH_SCHEDULE_NAME,
    API_CACHE_DISTRIBUTION_ID,
    API_CACHE_INVALIDATION_PATHS,
  };
}
module.exports = { createConfig };
