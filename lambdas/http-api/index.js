import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const GAME_OPTIONS_TABLE = process.env.GAME_OPTIONS_TABLE || 'GameOptions';
const PLAYER_SEASON_TABLE = process.env.PLAYER_SEASON_TABLE || 'PlayerSeason';
const PLAYER_LIFETIME_TABLE = process.env.PLAYER_LIFETIME_TABLE || 'PlayerLifetime';
const GAME_RECORDS_V2_TABLE = process.env.GAME_RECORDS_V2_TABLE || 'GameRecordsV2';
const DRAFT_STATE_TABLE = process.env.DRAFT_STATE_TABLE || 'DraftState';
const SEASON_CATALOG_ID = process.env.SEASON_CATALOG_ID || 'seasonCatalog';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const CACHE_TTLS = {
  roster: Number(process.env.PLAYERS_CACHE_TTL) || 60 * 60 * 6,
  gameRecords: Number(process.env.GAME_RECORDS_CACHE_TTL) || 60 * 15,
  playingDay: Number(process.env.PLAYING_DAY_CACHE_TTL) || 60 * 5,
  nonPlayingDay: Number(process.env.NON_PLAYING_DAY_CACHE_TTL) || 60 * 60 * 24,
  staleWhileRevalidate: Number(process.env.STALE_WHILE_REVALIDATE) || 60 * 5,
  staleWhileRevalidateLong: Number(process.env.STALE_WHILE_REVALIDATE_LONG) || 60 * 60,
  staleIfError: Number(process.env.STALE_IF_ERROR) || 60,
};

const DEFAULT_SEASON = normalizeSeasonId(process.env.DEFAULT_SEASON) || 'season2';

const ALLOWED_HOSTS = ['inseasoncup.com'];
const NHL_API_BASE =
  process.env.NHL_API_BASE || process.env.API_URL || 'https://api-web.nhle.com/v1';

const NHL_TEAMS = (process.env.NHL_TEAMS ||
  'ANA,BOS,BUF,CGY,CAR,CHI,COL,CBJ,DAL,DET,EDM,FLA,LAK,MIN,MTL,NSH,NJD,NYI,NYR,OTT,PHI,PIT,SJS,SEA,STL,TBL,TOR,UTA,VAN,VGK,WSH,WPG')
  .split(',')
  .map((team) => team.trim())
  .filter(Boolean);

const DEFAULT_DRAFT_STATE = Object.freeze({
  draftStarted: false,
  pickOrder: [],
  currentPicker: null,
  currentPickNumber: 0,
});

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
    if (ALLOWED_HOSTS.some((host) => hostname.endsWith(`.${host}`))) return origin;
  } catch (error) {
    console.error('Invalid origin header', origin, error);
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

  if (origin) {
    base['Access-Control-Allow-Origin'] = origin;
  }

  if (cacheOptions?.ttlSeconds) {
    const cacheControl = buildCacheControl(cacheOptions.ttlSeconds, cacheOptions);
    if (cacheControl) {
      base['Cache-Control'] = cacheControl;
      base['CDN-Cache-Control'] = cacheControl;
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
    path = path.slice(stage.length + 1);
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
  } catch (error) {
    console.error('Body parse failed', error);
    return {};
  }
}

function getHeaderValue(event, headerName) {
  const headers = event?.headers || {};
  const target = String(headerName || '').toLowerCase();
  const matched = Object.keys(headers).find(
    (key) => String(key).toLowerCase() === target
  );
  return matched ? headers[matched] : undefined;
}

function isAuthorized(event) {
  const requiredAdminToken = process.env.ADMIN_API_TOKEN;
  if (!requiredAdminToken) return true;
  const provided = getHeaderValue(event, 'x-admin-token');
  return provided === requiredAdminToken;
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
  if (!normalized) return null;

  const seasonMatch = normalized.match(/^season(\d+)$/);
  if (seasonMatch) {
    const seasonNumber = Number(seasonMatch[1]);
    if (Number.isInteger(seasonNumber) && seasonNumber > 0) {
      return `season${seasonNumber}`;
    }
    return null;
  }

  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `season${numeric}`;
  }

  return null;
}

function getSeasonNumber(seasonId) {
  const match = String(seasonId || '').match(/^season(\d+)$/);
  if (!match) return null;
  const seasonNumber = Number(match[1]);
  return Number.isInteger(seasonNumber) && seasonNumber > 0 ? seasonNumber : null;
}

function toSeasonLabel(seasonId) {
  const seasonNumber = getSeasonNumber(seasonId);
  return seasonNumber ? String(seasonNumber) : String(seasonId || '');
}

function normalizeSeasonOption(entry) {
  if (typeof entry === 'string') {
    const id = normalizeSeasonId(entry);
    if (!id) return null;
    return { id, label: toSeasonLabel(id), status: null };
  }

  if (!entry || typeof entry !== 'object') return null;
  const id = normalizeSeasonId(entry.id || entry.value);
  if (!id) return null;

  return {
    id,
    label: String(entry.label || toSeasonLabel(id)),
    status: entry.status || null,
  };
}

function parseSeasonsFromEnv() {
  const raw = String(process.env.AVAILABLE_SEASONS || '')
    .split(',')
    .map((value) => normalizeSeasonId(value))
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  raw.forEach((seasonId) => {
    if (seen.has(seasonId)) return;
    seen.add(seasonId);
    unique.push(seasonId);
  });

  if (!seen.has(DEFAULT_SEASON)) {
    unique.push(DEFAULT_SEASON);
  }
  if (!seen.has('season1')) {
    unique.unshift('season1');
  }

  return unique.map((seasonId) => ({
    id: seasonId,
    label: toSeasonLabel(seasonId),
    status: null,
  }));
}

async function getSeasonCatalogItem() {
  const result = await dynamoDB
    .get({
      TableName: GAME_OPTIONS_TABLE,
      Key: { id: SEASON_CATALOG_ID },
    })
    .promise();
  return result.Item || null;
}

async function getSeasonOptions() {
  const envFallback = {
    defaultSeason: DEFAULT_SEASON,
    seasons: parseSeasonsFromEnv(),
    updatedAt: null,
  };

  try {
    const item = await getSeasonCatalogItem();
    if (!item) return envFallback;

    const defaultSeason =
      normalizeSeasonId(item.defaultSeason || item.currentSeason) || DEFAULT_SEASON;

    const normalized = Array.isArray(item.seasons)
      ? item.seasons.map(normalizeSeasonOption).filter(Boolean)
      : [];

    const merged = [];
    const seen = new Set();

    normalized.forEach((entry) => {
      if (seen.has(entry.id)) return;
      seen.add(entry.id);
      merged.push(entry);
    });

    if (!seen.has(defaultSeason)) {
      merged.push({
        id: defaultSeason,
        label: toSeasonLabel(defaultSeason),
        status: null,
      });
    }

    if (merged.length === 0) {
      return envFallback;
    }

    merged.sort((a, b) => {
      const aNum = getSeasonNumber(a.id) || Number.MAX_SAFE_INTEGER;
      const bNum = getSeasonNumber(b.id) || Number.MAX_SAFE_INTEGER;
      return aNum - bNum;
    });

    return {
      defaultSeason,
      seasons: merged,
      updatedAt: item.updatedAt || null,
    };
  } catch (error) {
    console.error('Failed to load season options from GameOptions:', error);
    return envFallback;
  }
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

  return {
    requestedSeason,
    hasInvalidSeasonQuery,
    seasonId: requestedSeason || DEFAULT_SEASON,
  };
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function getSeasonMeta(seasonId) {
  const envPrefix = String(seasonId || '').toUpperCase();
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

function normalizePlayerId(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeTeamCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || null;
}

function normalizeTeams(teams) {
  if (!Array.isArray(teams)) return [];
  const unique = new Set();
  teams.forEach((team) => {
    const normalized = normalizeTeamCode(team);
    if (normalized) {
      unique.add(normalized);
    }
  });
  return Array.from(unique);
}

async function queryAll(params) {
  const items = [];
  let ExclusiveStartKey;

  do {
    const page = await dynamoDB
      .query({
        ...params,
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
      })
      .promise();

    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

async function scanAll(params) {
  const items = [];
  let ExclusiveStartKey;

  do {
    const page = await dynamoDB
      .scan({
        ...params,
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
      })
      .promise();

    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

async function listPlayerSeasonRows(seasonId) {
  return queryAll({
    TableName: PLAYER_SEASON_TABLE,
    KeyConditionExpression: '#seasonId = :seasonId',
    ExpressionAttributeNames: {
      '#seasonId': 'seasonId',
    },
    ExpressionAttributeValues: {
      ':seasonId': seasonId,
    },
  });
}

async function listPlayerLifetimeRows() {
  return scanAll({
    TableName: PLAYER_LIFETIME_TABLE,
  });
}

async function getPlayerSeasonRow(seasonId, playerId) {
  const result = await dynamoDB
    .get({
      TableName: PLAYER_SEASON_TABLE,
      Key: {
        seasonId,
        playerId,
      },
    })
    .promise();
  return result.Item || null;
}

async function getPlayerLifetimeRow(playerId) {
  const result = await dynamoDB
    .get({
      TableName: PLAYER_LIFETIME_TABLE,
      Key: { playerId },
    })
    .promise();
  return result.Item || null;
}

function mergePlayerRows({ seasonId, playerId, seasonRow, lifetimeRow }) {
  const normalizedPlayerId = normalizePlayerId(playerId);
  const titleDefenses = Number(seasonRow?.titleDefenses || 0);
  const totalDefenses = Number(lifetimeRow?.totalDefenses || 0);
  const championships = Number(lifetimeRow?.championships || 0);

  return {
    id: normalizedPlayerId,
    playerId: normalizedPlayerId,
    seasonId,
    name: seasonRow?.name || lifetimeRow?.name || normalizedPlayerId,
    teams: normalizeTeams(seasonRow?.teams),
    titleDefenses: Number.isFinite(titleDefenses) ? titleDefenses : 0,
    totalDefenses: Number.isFinite(totalDefenses) ? totalDefenses : 0,
    championships: Number.isFinite(championships) ? championships : 0,
    updatedAt: seasonRow?.updatedAt || lifetimeRow?.updatedAt || null,
  };
}

async function listPlayers(seasonId) {
  const [seasonRows, lifetimeRows] = await Promise.all([
    listPlayerSeasonRows(seasonId),
    listPlayerLifetimeRows(),
  ]);

  const seasonById = new Map();
  seasonRows.forEach((row) => {
    const playerId = normalizePlayerId(row.playerId);
    if (playerId) seasonById.set(playerId, row);
  });

  const lifetimeById = new Map();
  lifetimeRows.forEach((row) => {
    const playerId = normalizePlayerId(row.playerId || row.id);
    if (playerId) lifetimeById.set(playerId, row);
  });

  const allPlayerIds = new Set([
    ...Array.from(seasonById.keys()),
    ...Array.from(lifetimeById.keys()),
  ]);

  return Array.from(allPlayerIds)
    .map((playerId) =>
      mergePlayerRows({
        seasonId,
        playerId,
        seasonRow: seasonById.get(playerId),
        lifetimeRow: lifetimeById.get(playerId),
      })
    )
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function getPlayerByName(seasonId, name) {
  const players = await listPlayers(seasonId);
  return (
    players.find(
      (player) =>
        String(player?.name || '').toLowerCase() === String(name || '').toLowerCase()
    ) || null
  );
}

async function getPlayerById(seasonId, playerId) {
  const normalizedPlayerId = normalizePlayerId(playerId);
  if (!normalizedPlayerId) return null;

  const [seasonRow, lifetimeRow] = await Promise.all([
    getPlayerSeasonRow(seasonId, normalizedPlayerId),
    getPlayerLifetimeRow(normalizedPlayerId),
  ]);

  if (!seasonRow && !lifetimeRow) return null;

  return mergePlayerRows({
    seasonId,
    playerId: normalizedPlayerId,
    seasonRow,
    lifetimeRow,
  });
}

async function ensurePlayerSeasonRow(seasonId, playerId) {
  const normalizedPlayerId = normalizePlayerId(playerId);
  if (!normalizedPlayerId) {
    throw new Error('playerId is required');
  }

  const existing = await getPlayerSeasonRow(seasonId, normalizedPlayerId);
  if (existing) return existing;

  const lifetimeRow = await getPlayerLifetimeRow(normalizedPlayerId);
  const now = new Date().toISOString();
  const created = {
    seasonId,
    playerId: normalizedPlayerId,
    name: lifetimeRow?.name || normalizedPlayerId,
    teams: [],
    titleDefenses: 0,
    updatedAt: now,
  };

  try {
    await dynamoDB
      .put({
        TableName: PLAYER_SEASON_TABLE,
        Item: created,
        ConditionExpression:
          'attribute_not_exists(#seasonId) AND attribute_not_exists(#playerId)',
        ExpressionAttributeNames: {
          '#seasonId': 'seasonId',
          '#playerId': 'playerId',
        },
      })
      .promise();
  } catch (error) {
    if (error?.code !== 'ConditionalCheckFailedException') {
      throw error;
    }
  }

  return (await getPlayerSeasonRow(seasonId, normalizedPlayerId)) || created;
}

async function updatePlayerTeams(seasonId, playerId, team, action = 'add') {
  const normalizedPlayerId = normalizePlayerId(playerId);
  if (!normalizedPlayerId) throw new Error('playerId is required');

  const seasonRow = await ensurePlayerSeasonRow(seasonId, normalizedPlayerId);
  const currentTeams = normalizeTeams(seasonRow.teams);
  const normalizedTeam = normalizeTeamCode(team);

  if (!normalizedTeam) {
    throw new Error('team is required');
  }

  const nextTeams =
    action === 'remove'
      ? currentTeams.filter((candidate) => candidate !== normalizedTeam)
      : currentTeams.includes(normalizedTeam)
      ? currentTeams
      : [...currentTeams, normalizedTeam];

  const updatedAt = new Date().toISOString();

  await dynamoDB
    .update({
      TableName: PLAYER_SEASON_TABLE,
      Key: {
        seasonId,
        playerId: normalizedPlayerId,
      },
      UpdateExpression: 'SET teams = :teams, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':teams': nextTeams,
        ':updatedAt': updatedAt,
      },
    })
    .promise();

  return getPlayerById(seasonId, normalizedPlayerId);
}

async function resetTeams(seasonId) {
  const seasonRows = await listPlayerSeasonRows(seasonId);
  const updates = seasonRows.map((row) => {
    const playerId = normalizePlayerId(row.playerId);
    if (!playerId) return Promise.resolve();

    return dynamoDB
      .update({
        TableName: PLAYER_SEASON_TABLE,
        Key: {
          seasonId,
          playerId,
        },
        UpdateExpression: 'SET teams = :teams, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':teams': [],
          ':updatedAt': new Date().toISOString(),
        },
      })
      .promise();
  });

  await Promise.all(updates);
}

function normalizeGameRecord(record = {}) {
  const id = Number(record.id ?? record.gameId);
  const gameId = Number.isFinite(id) ? id : record.id ?? record.gameId ?? null;

  return {
    ...record,
    id: gameId,
    gameId,
  };
}

async function listGameRecords(seasonId) {
  const records = await queryAll({
    TableName: GAME_RECORDS_V2_TABLE,
    KeyConditionExpression: '#seasonId = :seasonId',
    ExpressionAttributeNames: {
      '#seasonId': 'seasonId',
    },
    ExpressionAttributeValues: {
      ':seasonId': seasonId,
    },
  });

  return records.map(normalizeGameRecord);
}

async function getGameOptions() {
  const result = await dynamoDB
    .get({ TableName: GAME_OPTIONS_TABLE, Key: { id: 'currentChampion' } })
    .promise();

  return result.Item || {};
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

  const result = await dynamoDB
    .update({
      TableName: GAME_OPTIONS_TABLE,
      Key: { id: 'currentChampion' },
      UpdateExpression: 'SET gameID = :gameID, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':gameID': gameID,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'UPDATED_NEW',
    })
    .promise();

  return result.Attributes?.gameID || gameID;
}

function getToday(tz = 'America/New_York') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function fetchSchedule(date) {
  const url = `${NHL_API_BASE}/schedule/${date}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
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

  const today = gameWeek.find((entry) => entry?.date === date);
  const games = today?.games || [];

  for (const game of games) {
    const home = game?.homeTeam?.abbrev;
    const away = game?.awayTeam?.abbrev;
    if (home === champion || away === champion) {
      return game.id;
    }
  }

  return null;
}

async function getDraftStateRow(seasonId) {
  const result = await dynamoDB
    .get({
      TableName: DRAFT_STATE_TABLE,
      Key: { draftId: seasonId },
    })
    .promise();

  return result.Item || null;
}

function normalizeDraftState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return {
      ...DEFAULT_DRAFT_STATE,
      availableTeams: [...NHL_TEAMS],
      version: 0,
      updatedAt: null,
    };
  }

  const parsedVersion = Number(rawState.version);
  const parsedPickNumber = Number(rawState.currentPickNumber);

  return {
    draftStarted: Boolean(rawState.draftStarted),
    pickOrder: Array.isArray(rawState.pickOrder)
      ? rawState.pickOrder.map((id) => normalizePlayerId(id)).filter(Boolean)
      : [],
    currentPicker: normalizePlayerId(rawState.currentPicker),
    currentPickNumber:
      Number.isInteger(parsedPickNumber) && parsedPickNumber >= 0
        ? parsedPickNumber
        : 0,
    availableTeams: Array.isArray(rawState.availableTeams)
      ? normalizeTeams(rawState.availableTeams)
      : [...NHL_TEAMS],
    version: Number.isInteger(parsedVersion) && parsedVersion >= 0 ? parsedVersion : 0,
    updatedAt: rawState.updatedAt || null,
  };
}

async function ensureDraftState(seasonId) {
  const existing = await getDraftStateRow(seasonId);
  const normalized = normalizeDraftState(existing);

  if (existing) {
    const needsNormalization =
      !Array.isArray(existing.availableTeams) ||
      !Number.isInteger(Number(existing.version)) ||
      !existing.updatedAt;

    if (needsNormalization) {
      const normalizedItem = {
        draftId: seasonId,
        ...normalized,
        updatedAt: new Date().toISOString(),
      };
      await dynamoDB
        .put({
          TableName: DRAFT_STATE_TABLE,
          Item: normalizedItem,
        })
        .promise();
      return normalizeDraftState(normalizedItem);
    }

    return normalized;
  }

  const created = {
    draftId: seasonId,
    ...DEFAULT_DRAFT_STATE,
    availableTeams: [...NHL_TEAMS],
    version: 0,
    updatedAt: new Date().toISOString(),
  };

  await dynamoDB
    .put({
      TableName: DRAFT_STATE_TABLE,
      Item: created,
      ConditionExpression: 'attribute_not_exists(draftId)',
    })
    .promise();

  return normalizeDraftState(created);
}

function parseDraftStateVersion(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

async function updateDraftState(seasonId, patch = {}) {
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

  const current = await ensureDraftState(seasonId);
  if (current.version !== expectedVersion) {
    throw new DraftStateConflictError('Draft state version conflict', current);
  }

  const patchWithoutVersion = { ...patch };
  delete patchWithoutVersion.version;
  delete patchWithoutVersion.updatedAt;

  const next = normalizeDraftState({
    ...current,
    ...patchWithoutVersion,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  });

  try {
    await dynamoDB
      .put({
        TableName: DRAFT_STATE_TABLE,
        Item: {
          draftId: seasonId,
          ...next,
        },
        ConditionExpression: 'attribute_exists(draftId) AND #version = :expectedVersion',
        ExpressionAttributeNames: {
          '#version': 'version',
        },
        ExpressionAttributeValues: {
          ':expectedVersion': expectedVersion,
        },
      })
      .promise();
  } catch (error) {
    if (error?.code === 'ConditionalCheckFailedException') {
      const latest = await ensureDraftState(seasonId);
      throw new DraftStateConflictError('Draft state version conflict', latest);
    }
    throw error;
  }

  return next;
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

  const gameId = Number(record.gameId ?? record.id);

  return {
    gameId: Number.isFinite(gameId) ? gameId : record.gameId ?? record.id ?? null,
    winnerTeam,
    winnerScore:
      Number.isFinite(Number(record.wScore)) && record.wScore !== null
        ? Number(record.wScore)
        : null,
    loserTeam,
    loserScore:
      Number.isFinite(Number(record.lScore)) && record.lScore !== null
        ? Number(record.lScore)
        : null,
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

async function listChampionHistory(seasonId, limit) {
  const records = await listGameRecords(seasonId);
  return records
    .map(mapChampionHistoryRecord)
    .sort((a, b) => historySortKey(b) - historySortKey(a))
    .slice(0, limit);
}

async function isDraftWriteWindowOpen(seasonContext) {
  if (parseBool(process.env.ALLOW_IN_SEASON_DRAFT_WRITES, false)) {
    return true;
  }

  const seasonMeta = getSeasonMeta(seasonContext.seasonId);
  if (seasonMeta.seasonOver) {
    return true;
  }

  const existingRecords = await listGameRecords(seasonContext.seasonId);
  return existingRecords.length === 0;
}

async function guardDraftWriteWindow(event, seasonContext) {
  const allowed = await isDraftWriteWindowOpen(seasonContext);
  if (allowed) return null;

  return response(event, 409, {
    error:
      'Draft/team updates are locked during active season. Updates are only allowed pre-season (no games recorded) or off-season (seasonOver=true).',
  });
}

export const handler = async (event) => {
  const path = normalizePath(event);
  const method = getMethod(event);
  const seasonContext = getSeasonContext(event);

  if (method === 'OPTIONS') {
    return response(event, 204, {});
  }

  try {
    if (seasonContext.hasInvalidSeasonQuery) {
      return response(event, 400, {
        error:
          'Invalid season query parameter. Use seasonN or N (for example season2 or 2).',
      });
    }

    if (path === '/season/options' && method === 'GET') {
      return response(event, 200, await getSeasonOptions(), {
        ttlSeconds: CACHE_TTLS.nonPlayingDay,
        staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateLong,
        staleIfError: CACHE_TTLS.staleIfError,
      });
    }

    if (path === '/players' && method === 'GET') {
      return response(event, 200, await listPlayers(seasonContext.seasonId), {
        ttlSeconds: CACHE_TTLS.roster,
        staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateLong,
        staleIfError: CACHE_TTLS.staleIfError,
      });
    }

    if (path.startsWith('/players/') && method === 'GET') {
      const name = decodeURIComponent(path.split('/').pop());
      return response(
        event,
        200,
        await getPlayerByName(seasonContext.seasonId, name)
      );
    }

    if (path === '/players/reset-teams' && method === 'POST') {
      if (!isAuthorized(event)) {
        return response(event, 401, { error: 'Unauthorized' });
      }
      const lockResponse = await guardDraftWriteWindow(event, seasonContext);
      if (lockResponse) return lockResponse;

      await resetTeams(seasonContext.seasonId);
      return response(event, 200, { ok: true });
    }

    const teamPatchMatch = path.match(/^\/players\/([^/]+)\/teams$/);
    if (teamPatchMatch && method === 'PATCH') {
      if (!isAuthorized(event)) {
        return response(event, 401, { error: 'Unauthorized' });
      }
      const lockResponse = await guardDraftWriteWindow(event, seasonContext);
      if (lockResponse) return lockResponse;

      const body = parseBody(event.body);
      const team = body?.team;
      const action = body?.action || 'add';
      if (!team) {
        return response(event, 400, { error: 'team is required' });
      }

      const updated = await updatePlayerTeams(
        seasonContext.seasonId,
        teamPatchMatch[1],
        team,
        action
      );

      return response(event, 200, updated);
    }

    if (path === '/game-records' && method === 'GET') {
      return response(event, 200, await listGameRecords(seasonContext.seasonId), {
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

      return response(
        event,
        200,
        {
          seasonId: seasonContext.seasonId,
          limit,
          history: await listChampionHistory(seasonContext.seasonId, limit),
        },
        {
          ttlSeconds: CACHE_TTLS.gameRecords,
          staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidate,
          staleIfError: CACHE_TTLS.staleIfError,
        }
      );
    }

    if (path === '/champion' && method === 'GET') {
      const gameOptions = await getGameOptions();
      const champion = gameOptions.champion;

      if (!champion) {
        return response(event, 404, { error: 'Champion not set in GameOptions' });
      }

      let gameID = gameOptions.activeGameId ?? gameOptions.gameID ?? null;
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
        } catch (error) {
          console.error('schedule lookup failed', error);
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
      const gameOptions = await getGameOptions();
      const activeGameId = gameOptions.activeGameId ?? gameOptions.gameID ?? null;
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
      const gameOptions = await getGameOptions();
      return response(event, 200, {
        seasonId: seasonContext.seasonId,
        champion: gameOptions.champion ?? null,
        gameID: gameOptions.activeGameId ?? gameOptions.gameID ?? null,
        activeGameId: gameOptions.activeGameId ?? null,
        checkStatus: gameOptions.checkStatus ?? null,
        nextCheckAt: gameOptions.nextCheckAt ?? null,
        lastCheckedAt: gameOptions.lastCheckedAt ?? null,
        finalizedAt: gameOptions.finalizedAt ?? null,
        processedGameId: gameOptions.processedGameId ?? null,
      });
    }

    if (path === '/season/meta' && method === 'GET') {
      return response(event, 200, getSeasonMeta(seasonContext.seasonId), {
        ttlSeconds: CACHE_TTLS.nonPlayingDay,
        staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateLong,
        staleIfError: CACHE_TTLS.staleIfError,
      });
    }

    if (path === '/draft/state' && method === 'GET') {
      return response(event, 200, await ensureDraftState(seasonContext.seasonId));
    }

    if (path === '/draft/state' && method === 'PATCH') {
      if (!isAuthorized(event)) {
        return response(event, 401, { error: 'Unauthorized' });
      }

      const lockResponse = await guardDraftWriteWindow(event, seasonContext);
      if (lockResponse) return lockResponse;

      const patch = parseBody(event.body);
      try {
        const state = await updateDraftState(seasonContext.seasonId, patch);
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

    if (path === '/draft/select-team' && method === 'POST') {
      if (!isAuthorized(event)) {
        return response(event, 401, { error: 'Unauthorized' });
      }

      const lockResponse = await guardDraftWriteWindow(event, seasonContext);
      if (lockResponse) return lockResponse;

      const { playerId, team } = parseBody(event.body);
      if (!playerId || !team) {
        return response(event, 400, {
          error: 'playerId and team are required',
        });
      }

      const updated = await updatePlayerTeams(
        seasonContext.seasonId,
        playerId,
        team,
        'add'
      );

      return response(event, 200, {
        player: updated,
        team,
      });
    }

    return response(event, 404, { error: 'Not found', path, method });
  } catch (error) {
    console.error('handler error', error);
    return response(event, 500, {
      error: 'Internal Server Error',
      detail: String(error),
    });
  }
};
