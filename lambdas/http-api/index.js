import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const cloudFront = AWS.CloudFront
  ? new AWS.CloudFront({
      region: process.env.AWS_REGION || 'us-east-1',
    })
  : null;

const PLAYERS_TABLE = process.env.PLAYERS_TABLE || 'Players';
const GAME_RECORDS_TABLE = process.env.GAME_RECORDS_TABLE || 'GameRecords';
const GAME_OPTIONS_TABLE = process.env.GAME_OPTIONS_TABLE || 'GameOptions';
const DRAFT_STATE_ID = process.env.DRAFT_STATE_ID || 'draftState';
const API_CACHE_DISTRIBUTION_ID = process.env.API_CACHE_DISTRIBUTION_ID || null;
const API_CACHE_INVALIDATION_PATHS = (
  process.env.API_CACHE_INVALIDATION_PATHS ||
  '/champion,/gameid,/season/meta,/players,/game-records,/check-status'
)
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean)
  .map((path) => (path.startsWith('/') ? path : `/${path}`));
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const CACHE_TTLS = {
  roster: Number(process.env.PLAYERS_CACHE_TTL) || 60 * 60 * 6, // 6 hours
  gameRecords: Number(process.env.GAME_RECORDS_CACHE_TTL) || 60 * 15, // 15 minutes
  playingDay: Number(process.env.PLAYING_DAY_CACHE_TTL) || 60 * 5, // 5 minutes
  nonPlayingDay: Number(process.env.NON_PLAYING_DAY_CACHE_TTL) || 60 * 60 * 24, // 24 hours
  offseason: Number(process.env.OFFSEASON_CACHE_TTL) || 60 * 60 * 24 * 30, // 30 days
  staleWhileRevalidate: Number(process.env.STALE_WHILE_REVALIDATE) || 60 * 5,
  staleWhileRevalidateLong: Number(process.env.STALE_WHILE_REVALIDATE_LONG) || 60 * 60, // 1 hour
  staleWhileRevalidateOffseason:
    Number(process.env.STALE_WHILE_REVALIDATE_OFFSEASON) || 60 * 60 * 24, // 24 hours
  staleIfError: Number(process.env.STALE_IF_ERROR) || 60,
};
const ALLOWED_HOSTS = ['inseasoncup.com'];
const NHL_API_BASE =
  process.env.NHL_API_BASE || process.env.API_URL || 'https://api-web.nhle.com/v1';

const NHL_TEAMS = (process.env.NHL_TEAMS ||
  'ANA,BOS,BUF,CGY,CAR,CHI,COL,CBJ,DAL,DET,EDM,FLA,LAK,MIN,MTL,NSH,NJD,NYI,NYR,OTT,PHI,PIT,SJS,SEA,STL,TBL,TOR,UTA,VAN,VGK,WSH,WPG')
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

class DraftStateValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DraftStateValidationError';
  }
}

class DraftStateConflictError extends Error {
  constructor(message, currentState = null) {
    super(message);
    this.name = 'DraftStateConflictError';
    this.currentState = currentState;
  }
}

function buildCacheControl(ttlSeconds, options = {}) {
  if (!ttlSeconds) return null;
  const scope = options.scope === 'private' ? 'private' : 'public';
  const directives = [
    scope,
    `max-age=${ttlSeconds}`,
    `s-maxage=${options.sharedMaxAge || options.sMaxAge || ttlSeconds}`,
  ];

  if (options.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  if (options.staleIfError) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  return directives.join(', ');
}

function getCorsOrigin(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (!origin) return CORS_ORIGIN === '*' ? '*' : null;
  try {
    const { hostname, protocol } = new URL(origin);
    if (!['http:', 'https:'].includes(protocol)) return null;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname === 'host.docker.internal'
    ) {
      return origin;
    }
    if (ALLOWED_HOSTS.includes(hostname)) return origin;
    if (ALLOWED_HOSTS.some((h) => hostname.endsWith(`.${h}`))) return origin;
  } catch (err) {
    console.error('Invalid origin header', origin, err);
  }
  return CORS_ORIGIN === '*' ? '*' : null;
}

function buildHeaders(event, cacheOptions = null) {
  const origin = getCorsOrigin(event);
  const base = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    Vary: 'Origin',
  };
  if (origin) base['Access-Control-Allow-Origin'] = origin;
  if (cacheOptions?.ttlSeconds) {
    const cacheControl = buildCacheControl(cacheOptions.ttlSeconds, cacheOptions);
    if (cacheControl) {
      base['Cache-Control'] = cacheControl;
      base['CDN-Cache-Control'] = cacheControl; // Some CDNs (e.g., CloudFront) respect this override.
    }
  }
  return base;
}

function response(event, statusCode, body, cacheOptions = null) {
  return {
    statusCode,
    headers: buildHeaders(event, cacheOptions),
    body: JSON.stringify(body ?? {}),
  };
}

function normalizePath(event) {
  const raw = event?.rawPath || event?.path || '/';
  const stage = event?.requestContext?.stage;
  let path = raw;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.slice(stage.length + 1); // remove "/{stage}"
  } else if (stage && path === `/${stage}`) {
    path = '/';
  }
  return path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
}

function getMethod(event) {
  return (
    event?.requestContext?.http?.method ||
    event?.httpMethod ||
    'GET'
  ).toUpperCase();
}

function parseBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (err) {
    console.error('Body parse failed', err);
    return {};
  }
}

function getHeaderValue(event, headerName) {
  const headers = event?.headers || {};
  const target = String(headerName || '').toLowerCase();
  const matchedKey = Object.keys(headers).find(
    (key) => String(key).toLowerCase() === target
  );
  if (!matchedKey) return undefined;
  return headers[matchedKey];
}

function isAuthorized(event) {
  const requiredAdminToken = process.env.ADMIN_API_TOKEN;
  if (!requiredAdminToken) return true;
  const providedToken = getHeaderValue(event, 'x-admin-token');
  return providedToken === requiredAdminToken;
}

function getQueryParams(event) {
  if (event?.queryStringParameters && typeof event.queryStringParameters === 'object') {
    return event.queryStringParameters;
  }
  if (!event?.rawQueryString) return {};
  return Object.fromEntries(new URLSearchParams(event.rawQueryString));
}

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
  const playersTableOverride = process.env[`PLAYERS_TABLE_SEASON${seasonNumber}`];
  const gameRecordsTableOverride =
    process.env[`GAME_RECORDS_TABLE_SEASON${seasonNumber}`];

  return {
    players:
      playersTableOverride ||
      (seasonNumber === 2 ? PLAYERS_TABLE : `${PLAYERS_TABLE}-Season${seasonNumber}`),
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
  const defaultSeason = normalizeSeasonId(process.env.DEFAULT_SEASON) || 'season2';
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
  const regularSeasonEnd = process.env[`${envPrefix}_REGULAR_SEASON_END`] || null;
  const playoffsStart = process.env[`${envPrefix}_PLAYOFFS_START`] || null;
  const explicitSeasonOver = process.env[`${envPrefix}_SEASON_OVER`];

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

function coerceId(value) {
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? value : asNumber;
}

function parseAutoPickSeconds(value, fallback = 60) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_AUTO_PICK_SECONDS);
}

function parseDraftStateVersion(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeIsoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function shouldDisableAutoPick(state) {
  if (!state.autoPickEnabled) return true;
  if (!state.draftStarted) return true;
  if (!state.currentPicker) return true;
  if (state.isLocked) return true;
  if (!Array.isArray(state.availableTeams) || state.availableTeams.length === 0) {
    return true;
  }
  return !Number.isInteger(state.autoPickSeconds) || state.autoPickSeconds <= 0;
}

function getNextAutoPickDeadline(state, now = Date.now()) {
  if (shouldDisableAutoPick(state)) return null;
  return new Date(now + state.autoPickSeconds * 1000).toISOString();
}

function normalizePickHistoryEntry(entry = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const team = String(entry.team || '')
    .trim()
    .toUpperCase();
  const rawPlayerId = entry.playerId;
  const hasPlayerId = rawPlayerId !== undefined && rawPlayerId !== null && rawPlayerId !== '';
  if (!team || !hasPlayerId) return null;

  const pickNumberRaw = Number(entry.pickNumber);
  const pickNumber =
    Number.isInteger(pickNumberRaw) && pickNumberRaw > 0
      ? pickNumberRaw
      : null;

  return {
    playerId: coerceId(rawPlayerId),
    team,
    pickNumber,
    pickedAt: normalizeIsoDate(entry.pickedAt),
  };
}

function normalizePickHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map(normalizePickHistoryEntry)
    .filter(Boolean);
}

function normalizeDraftState(state = {}, options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const normalized = {
    ...DEFAULT_DRAFT_STATE,
    ...state,
  };

  if (!Array.isArray(normalized.pickOrder)) {
    normalized.pickOrder = [];
  }
  if (!Array.isArray(normalized.availableTeams)) {
    normalized.availableTeams = [...NHL_TEAMS];
  }

  normalized.currentPicker =
    normalized.currentPicker === undefined ? null : normalized.currentPicker;
  normalized.currentPickNumber = Number.isInteger(Number(normalized.currentPickNumber))
    ? Number(normalized.currentPickNumber)
    : 0;
  normalized.version = Number.isInteger(Number(normalized.version))
    ? Math.max(0, Number(normalized.version))
    : 0;
  normalized.draftStarted = Boolean(normalized.draftStarted);
  normalized.isLocked = Boolean(normalized.isLocked);
  normalized.autoPickEnabled = Boolean(normalized.autoPickEnabled);
  normalized.autoPickSeconds = parseAutoPickSeconds(normalized.autoPickSeconds);
  normalized.pickHistory = normalizePickHistory(normalized.pickHistory);
  normalized.updatedAt = normalizeIsoDate(normalized.updatedAt) || nowIso;

  const normalizedDeadline = normalizeIsoDate(normalized.autoPickDeadlineAt);
  if (shouldDisableAutoPick(normalized)) {
    normalized.autoPickDeadlineAt = null;
  } else {
    normalized.autoPickDeadlineAt = normalizedDeadline;
  }

  return normalized;
}

function shouldRefreshAutoPickDeadline(patch = {}) {
  const deadlineTriggers = [
    'draftStarted',
    'currentPicker',
    'isLocked',
    'availableTeams',
    'autoPickEnabled',
    'autoPickSeconds',
  ];
  return deadlineTriggers.some((key) =>
    Object.prototype.hasOwnProperty.call(patch, key)
  );
}

function getToday(tz = 'America/New_York') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function listPlayers(tableName = PLAYERS_TABLE) {
  const result = await dynamoDB.scan({ TableName: tableName }).promise();
  return result.Items || [];
}

async function getPlayerByName(name, tableName = PLAYERS_TABLE) {
  const res = await dynamoDB
    .query({
      TableName: tableName,
      IndexName: 'NameIndex',
      KeyConditionExpression: '#n = :name',
      ExpressionAttributeNames: { '#n': 'name' },
      ExpressionAttributeValues: { ':name': name },
      Limit: 1,
    })
    .promise();
  return res.Items?.[0] || null;
}

async function getPlayerById(id, tableName = PLAYERS_TABLE) {
  const res = await dynamoDB
    .get({ TableName: tableName, Key: { id } })
    .promise();
  return res.Item || null;
}

async function updatePlayerTeams(id, team, action = 'add', tableName = PLAYERS_TABLE) {
  const player = await getPlayerById(id, tableName);
  if (!player) throw new Error(`Player ${id} not found`);

  const currentTeams = Array.isArray(player.teams) ? [...player.teams] : [];
  const nextTeams =
    action === 'remove'
      ? currentTeams.filter((t) => t !== team)
      : currentTeams.includes(team)
      ? currentTeams
      : [...currentTeams, team];

  const res = await dynamoDB
    .update({
      TableName: tableName,
      Key: { id },
      UpdateExpression: 'SET teams = :teams, updatedAt = :ts',
      ExpressionAttributeValues: {
        ':teams': nextTeams,
        ':ts': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    })
    .promise();

  return res.Attributes;
}

async function resetTeams(tableName = PLAYERS_TABLE) {
  const allPlayers = await listPlayers(tableName);
  const promises = allPlayers.map((p) =>
    dynamoDB
      .update({
        TableName: tableName,
        Key: { id: p.id },
        UpdateExpression: 'REMOVE teams',
      })
      .promise()
  );
  await Promise.all(promises);
}

async function listGameRecords(tableName = GAME_RECORDS_TABLE) {
  const result = await dynamoDB.scan({ TableName: tableName }).promise();
  return result.Items || [];
}

async function getGameOptions() {
  const res = await dynamoDB
    .get({ TableName: GAME_OPTIONS_TABLE, Key: { id: 'currentChampion' } })
    .promise();
  return res.Item || {};
}

async function setGameId(gameID) {
  if (!gameID) {
    await dynamoDB
      .update({
        TableName: GAME_OPTIONS_TABLE,
        Key: { id: 'currentChampion' },
        UpdateExpression: 'REMOVE gameID',
      })
      .promise();
    return null;
  }

  const res = await dynamoDB
    .update({
      TableName: GAME_OPTIONS_TABLE,
      Key: { id: 'currentChampion' },
      UpdateExpression: 'SET gameID = :g, updatedAt = :ts',
      ExpressionAttributeValues: {
        ':g': gameID,
        ':ts': new Date().toISOString(),
      },
      ReturnValues: 'UPDATED_NEW',
    })
    .promise();
  return res.Attributes?.gameID || gameID;
}

/**
 * Invalidates CloudFront API cache for configured paths
 *
 * Triggers cache refresh across all CloudFront edge locations for the specified
 * distribution. This forces fresh data to be fetched from origin on the next request.
 *
 * @param {string} reason - Reason for invalidation (used in caller reference for tracking/logging)
 * @returns {Promise<string|null>} - CloudFront invalidation ID or null if not configured
 *
 * @example
 * // Invalidate cache when draft starts
 * await invalidateApiCache('draft_started');
 *
 * @note CloudFront free tier includes 1000 invalidation paths/month
 *       Additional paths cost $0.005 per path
 */
async function invalidateApiCache(reason = 'manual') {
  if (!cloudFront || !API_CACHE_DISTRIBUTION_ID) {
    return null;
  }

  const paths = API_CACHE_INVALIDATION_PATHS.length
    ? API_CACHE_INVALIDATION_PATHS
    : ['/champion', '/gameid', '/season/meta'];
  const callerReference = `http-api-${reason}-${Date.now()}`;

  try {
    const result = await cloudFront
      .createInvalidation({
        DistributionId: API_CACHE_DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: callerReference,
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      })
      .promise();
    return result?.Invalidation?.Id || null;
  } catch (error) {
    console.error('cache invalidation failed', {
      reason,
      distributionId: API_CACHE_DISTRIBUTION_ID,
      paths,
      error: String(error),
    });
    return null;
  }
}

async function fetchSchedule(date) {
  const url = `${NHL_API_BASE}/schedule/${date}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error('Request timed out'));
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

async function ensureDraftState() {
  const res = await dynamoDB
    .get({ TableName: GAME_OPTIONS_TABLE, Key: { id: DRAFT_STATE_ID } })
    .promise();
  if (res.Item?.state) {
    const state = normalizeDraftState(
      {
        ...res.Item.state,
        updatedAt: res.Item.state.updatedAt || res.Item.updatedAt,
      },
      {
        nowIso: new Date().toISOString(),
      }
    );

    const needsNormalization =
      typeof res.Item.state.isLocked !== 'boolean' ||
      typeof res.Item.state.autoPickEnabled !== 'boolean' ||
      !Number.isInteger(Number(res.Item.state.autoPickSeconds)) ||
      !Array.isArray(res.Item.state.pickHistory) ||
      !Array.isArray(res.Item.state.availableTeams) ||
      !Number.isInteger(Number(res.Item.state.version)) ||
      !res.Item.state.updatedAt ||
      normalizeIsoDate(res.Item.state.autoPickDeadlineAt || null) !==
        state.autoPickDeadlineAt;
    if (needsNormalization) {
      const now = new Date().toISOString();
      state.updatedAt = now;
      await dynamoDB
        .update({
          TableName: GAME_OPTIONS_TABLE,
          Key: { id: DRAFT_STATE_ID },
          UpdateExpression: 'SET #state = :state, #updatedAt = :ts',
          ExpressionAttributeNames: {
            '#state': 'state',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':state': state,
            ':ts': now,
          },
        })
        .promise();
    }
    return state;
  }

  const state = {
    ...normalizeDraftState(
      {
        ...DEFAULT_DRAFT_STATE,
        availableTeams: [...NHL_TEAMS],
      },
      {
        nowIso: new Date().toISOString(),
      }
    ),
    version: 0,
  };

  await dynamoDB
    .put({
      TableName: GAME_OPTIONS_TABLE,
      Item: {
        id: DRAFT_STATE_ID,
        state,
        updatedAt: state.updatedAt,
      },
    })
    .promise();

  return state;
}

function getDraftStateVersionCondition() {
  return '(attribute_not_exists(#state.#version) AND :expected = :zero) OR #state.#version = :expected';
}

function buildDraftStateVersionedWrite(nextState, expectedVersion) {
  return {
    TableName: GAME_OPTIONS_TABLE,
    Key: { id: DRAFT_STATE_ID },
    UpdateExpression: 'SET #state = :state, #updatedAt = :ts',
    ConditionExpression: getDraftStateVersionCondition(),
    ExpressionAttributeNames: {
      '#state': 'state',
      '#version': 'version',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':state': nextState,
      ':ts': nextState.updatedAt,
      ':expected': expectedVersion,
      ':zero': 0,
    },
  };
}

async function updateDraftState(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new DraftStateValidationError('patch body must be an object');
  }
  if (patch.version === undefined) {
    throw new DraftStateValidationError('version is required');
  }
  const expectedVersion = parseDraftStateVersion(patch.version);
  if (expectedVersion === null) {
    throw new DraftStateValidationError('version must be a non-negative integer');
  }

  const current = await ensureDraftState();
  if (expectedVersion !== current.version) {
    throw new DraftStateConflictError(
      'Draft state version conflict',
      current
    );
  }

  const patchWithoutVersion = { ...patch };
  delete patchWithoutVersion.version;
  delete patchWithoutVersion.updatedAt;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const next = normalizeDraftState(
    {
      ...current,
      ...patchWithoutVersion,
      updatedAt: nowIso,
    },
    {
      nowIso,
    }
  );

  if (shouldDisableAutoPick(next)) {
    next.autoPickDeadlineAt = null;
  } else if (shouldRefreshAutoPickDeadline(patchWithoutVersion)) {
    next.autoPickDeadlineAt = getNextAutoPickDeadline(next, now);
  } else if (!next.autoPickDeadlineAt) {
    next.autoPickDeadlineAt = getNextAutoPickDeadline(next, now);
  }

  next.version = current.version + 1;

  try {
    await dynamoDB.update(buildDraftStateVersionedWrite(next, expectedVersion)).promise();
  } catch (err) {
    if (err?.code === 'ConditionalCheckFailedException') {
      const latest = await ensureDraftState();
      throw new DraftStateConflictError(
        'Draft state version conflict',
        latest
      );
    }
    throw err;
  }

  if (!current.draftStarted && next.draftStarted) {
    await invalidateApiCache('draft_started');
  }

  return next;
}

function normalizeDraftTeam(team) {
  const normalized = String(team || '')
    .trim()
    .toUpperCase();
  return normalized || null;
}

function getNextPicker(pickOrder = [], currentPicker) {
  if (!Array.isArray(pickOrder) || pickOrder.length === 0) return null;
  const currentIndex = pickOrder.findIndex(
    (entry) => coerceId(entry) === coerceId(currentPicker)
  );
  if (currentIndex < 0) return null;
  const nextIndex = (currentIndex + 1) % pickOrder.length;
  return pickOrder[nextIndex];
}

function mapPlayerWithTeams(player, teams, updatedAt) {
  return {
    ...(player || {}),
    teams,
    updatedAt,
  };
}

async function makeDraftPick({ playerId, team, version, playersTable }) {
  const expectedVersion = parseDraftStateVersion(version);
  if (expectedVersion === null) {
    throw new DraftStateValidationError('version must be a non-negative integer');
  }

  const normalizedPlayerId = coerceId(playerId);
  const normalizedTeam = normalizeDraftTeam(team);
  if (!normalizedTeam) {
    throw new DraftStateValidationError('team is required');
  }

  const current = await ensureDraftState();
  if (expectedVersion !== current.version) {
    throw new DraftStateConflictError('Draft state version conflict', current);
  }
  if (!current.draftStarted) {
    throw new DraftStateValidationError('Draft has not started');
  }
  if (current.isLocked) {
    throw new DraftStateValidationError('Draft is locked');
  }
  if (!Array.isArray(current.pickOrder) || current.pickOrder.length === 0) {
    throw new DraftStateValidationError('Draft pick order is not configured');
  }
  if (coerceId(current.currentPicker) !== normalizedPlayerId) {
    throw new DraftStateValidationError('It is not this player\'s turn');
  }
  if (!Array.isArray(current.availableTeams) || !current.availableTeams.includes(normalizedTeam)) {
    throw new DraftStateValidationError('Team is no longer available');
  }

  const player = await getPlayerById(normalizedPlayerId, playersTable);
  if (!player) {
    throw new DraftStateValidationError(`Player ${normalizedPlayerId} was not found`);
  }

  const existingTeams = Array.isArray(player.teams) ? [...player.teams] : [];
  if (existingTeams.includes(normalizedTeam)) {
    throw new DraftStateValidationError('Player already has that team');
  }

  const nextPicker = getNextPicker(current.pickOrder, current.currentPicker);
  if (nextPicker === null) {
    throw new DraftStateValidationError('Draft current picker is not in pick order');
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const nextPlayerTeams = [...existingTeams, normalizedTeam];
  const nextAvailableTeams = current.availableTeams.filter((entry) => entry !== normalizedTeam);
  const pickNumber = Math.max(1, Number(current.currentPickNumber) || 1);
  const nextState = normalizeDraftState(
    {
      ...current,
      availableTeams: nextAvailableTeams,
      currentPicker: nextPicker,
      currentPickNumber: pickNumber + 1,
      pickHistory: [
        ...(current.pickHistory || []),
        {
          playerId: normalizedPlayerId,
          team: normalizedTeam,
          pickNumber,
          pickedAt: nowIso,
        },
      ],
      updatedAt: nowIso,
      version: current.version + 1,
    },
    {
      nowIso,
    }
  );
  nextState.autoPickDeadlineAt = getNextAutoPickDeadline(nextState, now);

  try {
    await dynamoDB
      .transactWrite({
        TransactItems: [
          {
            Update: {
              TableName: playersTable,
              Key: { id: normalizedPlayerId },
              UpdateExpression: 'SET teams = :teams, updatedAt = :ts',
              ConditionExpression:
                'attribute_exists(id) AND (attribute_not_exists(teams) OR NOT contains(teams, :team))',
              ExpressionAttributeValues: {
                ':teams': nextPlayerTeams,
                ':ts': nowIso,
                ':team': normalizedTeam,
              },
            },
          },
          {
            Update: buildDraftStateVersionedWrite(nextState, expectedVersion),
          },
        ],
      })
      .promise();
  } catch (err) {
    if (
      err?.code === 'ConditionalCheckFailedException' ||
      err?.code === 'TransactionCanceledException'
    ) {
      const latest = await ensureDraftState();
      throw new DraftStateConflictError(
        'Draft state changed before the pick could be applied',
        latest
      );
    }
    throw err;
  }

  return {
    team: normalizedTeam,
    player: mapPlayerWithTeams(player, nextPlayerTeams, nowIso),
    state: nextState,
  };
}

async function undoLastDraftPick({ version, playersTable }) {
  const expectedVersion = parseDraftStateVersion(version);
  if (expectedVersion === null) {
    throw new DraftStateValidationError('version must be a non-negative integer');
  }

  const current = await ensureDraftState();
  if (expectedVersion !== current.version) {
    throw new DraftStateConflictError('Draft state version conflict', current);
  }

  const history = normalizePickHistory(current.pickHistory);
  if (history.length === 0) {
    throw new DraftStateValidationError('No picks are available to undo');
  }

  const lastPick = history[history.length - 1];
  const undoPlayerId = coerceId(lastPick.playerId);
  const undoTeam = normalizeDraftTeam(lastPick.team);
  if (!undoTeam) {
    throw new DraftStateValidationError('Last pick is invalid and cannot be undone');
  }

  const player = await getPlayerById(undoPlayerId, playersTable);
  if (!player) {
    throw new DraftStateValidationError(`Player ${undoPlayerId} was not found`);
  }

  const existingTeams = Array.isArray(player.teams) ? [...player.teams] : [];
  if (!existingTeams.includes(undoTeam)) {
    throw new DraftStateValidationError('Last picked team is not assigned to the expected player');
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const nextPlayerTeams = existingTeams.filter((entry) => entry !== undoTeam);
  const nextAvailableTeams = current.availableTeams.includes(undoTeam)
    ? [...current.availableTeams]
    : [...current.availableTeams, undoTeam];
  const fallbackPickNumber = Math.max(1, Number(current.currentPickNumber || 1) - 1);
  const restoredPickNumber =
    Number.isInteger(lastPick.pickNumber) && lastPick.pickNumber > 0
      ? lastPick.pickNumber
      : fallbackPickNumber;

  const nextState = normalizeDraftState(
    {
      ...current,
      availableTeams: nextAvailableTeams,
      currentPicker: undoPlayerId,
      currentPickNumber: restoredPickNumber,
      pickHistory: history.slice(0, -1),
      updatedAt: nowIso,
      version: current.version + 1,
    },
    {
      nowIso,
    }
  );
  nextState.autoPickDeadlineAt = getNextAutoPickDeadline(nextState, now);

  try {
    await dynamoDB
      .transactWrite({
        TransactItems: [
          {
            Update: {
              TableName: playersTable,
              Key: { id: undoPlayerId },
              UpdateExpression: 'SET teams = :teams, updatedAt = :ts',
              ConditionExpression: 'attribute_exists(id) AND contains(teams, :team)',
              ExpressionAttributeValues: {
                ':teams': nextPlayerTeams,
                ':ts': nowIso,
                ':team': undoTeam,
              },
            },
          },
          {
            Update: buildDraftStateVersionedWrite(nextState, expectedVersion),
          },
        ],
      })
      .promise();
  } catch (err) {
    if (
      err?.code === 'ConditionalCheckFailedException' ||
      err?.code === 'TransactionCanceledException'
    ) {
      const latest = await ensureDraftState();
      throw new DraftStateConflictError(
        'Draft state changed before the undo could be applied',
        latest
      );
    }
    throw err;
  }

  return {
    undonePick: lastPick,
    player: mapPlayerWithTeams(player, nextPlayerTeams, nowIso),
    state: nextState,
  };
}

function parseHistoryLimit(limitRaw) {
  if (limitRaw === undefined || limitRaw === null || limitRaw === '') {
    return 25;
  }
  const parsed = Number(limitRaw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return Math.min(parsed, 200);
}

function mapChampionHistoryRecord(record = {}) {
  const winnerTeam = record.wTeam ?? null;
  const loserTeam = record.lTeam ?? null;
  const participants = [winnerTeam, loserTeam].filter(Boolean);
  const recordedAt =
    record.savedAt ||
    record.finalizedAt ||
    record.updatedAt ||
    record.createdAt ||
    null;
  const idNumber = Number(record.id);
  return {
    gameId: Number.isFinite(idNumber) ? idNumber : record.id ?? null,
    winnerTeam,
    winnerScore: Number.isFinite(Number(record.wScore))
      ? Number(record.wScore)
      : null,
    loserTeam,
    loserScore: Number.isFinite(Number(record.lScore)) ? Number(record.lScore) : null,
    participants,
    recordedAt,
  };
}

function historySortKey(entry = {}) {
  const timestamp = Date.parse(entry.recordedAt || '');
  if (Number.isFinite(timestamp)) return timestamp;
  const gameIdNumber = Number(entry.gameId);
  if (Number.isFinite(gameIdNumber)) return gameIdNumber;
  return -1;
}

async function listChampionHistory(limit, tableName = GAME_RECORDS_TABLE) {
  const records = await listGameRecords(tableName);
  return records
    .map(mapChampionHistoryRecord)
    .sort((a, b) => historySortKey(b) - historySortKey(a))
    .slice(0, limit);
}

export const handler = async (event) => {
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
      return response(event, 200, await getPlayerByName(name, seasonContext.playersTable));
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
      return response(event, 200, await listGameRecords(seasonContext.gameRecordsTable), {
        ttlSeconds: CACHE_TTLS.gameRecords,
        staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
        staleIfError: CACHE_TTLS.staleIfError,
      });
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
        return response(event, 404, { error: 'Champion not set in GameOptions' });
      }

      const seasonMeta = getSeasonMeta(seasonContext.seasonId);
      let gameID = opts.activeGameId ?? opts.gameID ?? null;
      let cacheOptions = seasonMeta.seasonOver
        ? {
            ttlSeconds: CACHE_TTLS.offseason,
            staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateOffseason,
            staleIfError: CACHE_TTLS.staleIfError,
          }
        : {
            ttlSeconds: CACHE_TTLS.playingDay,
            staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
            staleIfError: CACHE_TTLS.staleIfError,
          };
      if (seasonMeta.seasonOver) {
        gameID = null;
        await setGameId(null);
      } else if (NHL_API_BASE) {
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
        { champion, gameID, activeGameId: gameID, seasonId: seasonContext.seasonId },
        cacheOptions
      );
    }

    if (path === '/gameid' && method === 'GET') {
      const opts = await getGameOptions();
      const seasonMeta = getSeasonMeta(seasonContext.seasonId);
      const activeGameId = seasonMeta.seasonOver
        ? null
        : opts.activeGameId ?? opts.gameID ?? null;
      const hasActiveGame = Boolean(activeGameId);
      return response(
        event,
        200,
        { gameID: activeGameId, activeGameId, seasonId: seasonContext.seasonId },
        hasActiveGame
          ? {
              ttlSeconds: CACHE_TTLS.playingDay,
              staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
              staleIfError: CACHE_TTLS.staleIfError,
            }
          : {
              ttlSeconds: seasonMeta.seasonOver
                ? CACHE_TTLS.offseason
                : CACHE_TTLS.nonPlayingDay,
              staleWhileRevalidate: seasonMeta.seasonOver
                ? CACHE_TTLS.staleWhileRevalidateOffseason
                : CACHE_TTLS.staleWhileRevalidateLong,
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
      const seasonMeta = getSeasonMeta(seasonContext.seasonId);
      return response(
        event,
        200,
        seasonMeta,
        {
          ttlSeconds: seasonMeta.seasonOver
            ? CACHE_TTLS.offseason
            : CACHE_TTLS.nonPlayingDay,
          staleWhileRevalidate: seasonMeta.seasonOver
            ? CACHE_TTLS.staleWhileRevalidateOffseason
            : CACHE_TTLS.staleWhileRevalidateLong,
          staleIfError: CACHE_TTLS.staleIfError,
        }
      );
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
        return response(event, 400, { error: 'playerId and team are required' });
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
    return response(event, 500, { error: 'Internal Server Error', detail: String(err) });
  }
};
