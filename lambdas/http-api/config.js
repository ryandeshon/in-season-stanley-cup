export function createConfig(env) {
  const PLAYERS_TABLE = env.PLAYERS_TABLE || 'Players';
  const GAME_RECORDS_TABLE = env.GAME_RECORDS_TABLE || 'GameRecords';
  const GAME_OPTIONS_TABLE = env.GAME_OPTIONS_TABLE || 'GameOptions';
  const DRAFT_STATE_ID = env.DRAFT_STATE_ID || 'draftState';
  const CORS_ORIGIN = env.CORS_ORIGIN || '*';
  const CACHE_TTLS = {
    roster: Number(env.PLAYERS_CACHE_TTL) || 60 * 60 * 6, // 6 hours
    gameRecords: Number(env.GAME_RECORDS_CACHE_TTL) || 60 * 15, // 15 minutes
    playingDay: Number(env.PLAYING_DAY_CACHE_TTL) || 60 * 5, // 5 minutes
    nonPlayingDay: Number(env.NON_PLAYING_DAY_CACHE_TTL) || 60 * 60 * 24, // 24 hours
    staleWhileRevalidate: Number(env.STALE_WHILE_REVALIDATE) || 60 * 5,
    staleWhileRevalidateLong:
      Number(env.STALE_WHILE_REVALIDATE_LONG) || 60 * 60, // 1 hour
    staleIfError: Number(env.STALE_IF_ERROR) || 60,
  };
  const ALLOWED_HOSTS = ['inseasoncup.com'];
  const NHL_API_BASE =
    env.NHL_API_BASE || env.API_URL || 'https://api-web.nhle.com/v1';

  const NHL_TEAMS = (
    env.NHL_TEAMS ||
    'ANA,BOS,BUF,CGY,CAR,CHI,COL,CBJ,DAL,DET,EDM,FLA,LAK,MIN,MTL,NSH,NJD,NYI,NYR,OTT,PHI,PIT,SJS,SEA,STL,TBL,TOR,UTA,VAN,VGK,WSH,WPG'
  )
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const DEFAULT_DRAFT_STATE = Object.freeze({
    draftStarted: false,
    pickOrder: [],
    currentPicker: null,
    currentPickNumber: 0,
    isLocked: false,
    autoPickEnabled: false,
    autoPickSeconds: 60,
    autoPickDeadlineAt: null,
    pickHistory: [],
  });

  const MAX_AUTO_PICK_SECONDS = 600;

  return {
    PLAYERS_TABLE,
    GAME_RECORDS_TABLE,
    GAME_OPTIONS_TABLE,
    DRAFT_STATE_ID,
    CORS_ORIGIN,
    CACHE_TTLS,
    ALLOWED_HOSTS,
    NHL_API_BASE,
    NHL_TEAMS,
    DEFAULT_DRAFT_STATE,
    MAX_AUTO_PICK_SECONDS,
  };
}
