import https from 'https';
import AWS from 'aws-sdk';

const dynamoDB = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const PLAYERS_TABLE = process.env.PLAYERS_TABLE || 'Players';
const GAME_RECORDS_TABLE = process.env.GAME_RECORDS_TABLE || 'GameRecords';
const GAME_OPTIONS_TABLE = process.env.GAME_OPTIONS_TABLE || 'GameOptions';
const DRAFT_STATE_ID = process.env.DRAFT_STATE_ID || 'draftState';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const CACHE_TTLS = {
  roster: Number(process.env.PLAYERS_CACHE_TTL) || 60 * 60 * 6, // 6 hours
  gameRecords: Number(process.env.GAME_RECORDS_CACHE_TTL) || 60 * 15, // 15 minutes
  playingDay: Number(process.env.PLAYING_DAY_CACHE_TTL) || 60 * 5, // 5 minutes
  nonPlayingDay: Number(process.env.NON_PLAYING_DAY_CACHE_TTL) || 60 * 60 * 24, // 24 hours
  staleWhileRevalidate: Number(process.env.STALE_WHILE_REVALIDATE) || 60 * 5,
  staleWhileRevalidateLong: Number(process.env.STALE_WHILE_REVALIDATE_LONG) || 60 * 60, // 1 hour
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

function coerceId(value) {
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? value : asNumber;
}

function getToday(tz = 'America/New_York') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function listPlayers() {
  const result = await dynamoDB.scan({ TableName: PLAYERS_TABLE }).promise();
  return result.Items || [];
}

async function getPlayerByName(name) {
  const res = await dynamoDB
    .query({
      TableName: PLAYERS_TABLE,
      IndexName: 'NameIndex',
      KeyConditionExpression: '#n = :name',
      ExpressionAttributeNames: { '#n': 'name' },
      ExpressionAttributeValues: { ':name': name },
      Limit: 1,
    })
    .promise();
  return res.Items?.[0] || null;
}

async function getPlayerById(id) {
  const res = await dynamoDB
    .get({ TableName: PLAYERS_TABLE, Key: { id } })
    .promise();
  return res.Item || null;
}

async function updatePlayerTeams(id, team, action = 'add') {
  const player = await getPlayerById(id);
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
      TableName: PLAYERS_TABLE,
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

async function resetTeams() {
  const allPlayers = await listPlayers();
  const promises = allPlayers.map((p) =>
    dynamoDB
      .update({
        TableName: PLAYERS_TABLE,
        Key: { id: p.id },
        UpdateExpression: 'REMOVE teams',
      })
      .promise()
  );
  await Promise.all(promises);
}

async function listGameRecords() {
  const result = await dynamoDB.scan({ TableName: GAME_RECORDS_TABLE }).promise();
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
  if (res.Item?.state) return res.Item.state;

  const state = {
    draftStarted: false,
    pickOrder: [],
    currentPicker: null,
    currentPickNumber: 0,
    availableTeams: NHL_TEAMS,
  };

  await dynamoDB
    .put({
      TableName: GAME_OPTIONS_TABLE,
      Item: {
        id: DRAFT_STATE_ID,
        state,
        updatedAt: new Date().toISOString(),
      },
    })
    .promise();

  return state;
}

async function updateDraftState(patch = {}) {
  const current = await ensureDraftState();
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await dynamoDB
    .put({
      TableName: GAME_OPTIONS_TABLE,
      Item: {
        id: DRAFT_STATE_ID,
        state: next,
        updatedAt: next.updatedAt,
      },
    })
    .promise();

  return next;
}

export const handler = async (event) => {
  const path = normalizePath(event);
  const method = getMethod(event);

  if (method === 'OPTIONS') return response(event, 204, {});

  try {
    // ---- Players ----
    if (path === '/players' && method === 'GET') {
      return response(event, 200, await listPlayers(), {
        ttlSeconds: CACHE_TTLS.roster,
        staleWhileRevalidate: CACHE_TTLS.staleWhileRevalidateLong,
        staleIfError: CACHE_TTLS.staleIfError,
      });
    }

    if (path.startsWith('/players/') && method === 'GET') {
      const name = decodeURIComponent(path.split('/').pop());
      return response(event, 200, await getPlayerByName(name));
    }

    if (path === '/players/reset-teams' && method === 'POST') {
      await resetTeams();
      return response(event, 200, { ok: true });
    }

    const teamPatchMatch = path.match(/^\/players\/([^/]+)\/teams$/);
    if (teamPatchMatch && method === 'PATCH') {
      const body = parseBody(event.body);
      const team = body?.team;
      const action = body?.action || 'add';
      if (!team) return response(400, { error: 'team is required' });
      const playerId = coerceId(teamPatchMatch[1]);
      const updated = await updatePlayerTeams(playerId, team, action);
      return response(event, 200, updated);
    }

    // ---- Game records ----
    if (path === '/game-records' && method === 'GET') {
      return response(event, 200, await listGameRecords());
    }

    // ---- Champion + game id ----
    if (path === '/champion' && method === 'GET') {
      const opts = await getGameOptions();
      const champion = opts.champion;
      if (!champion) {
        return response(event, 404, { error: 'Champion not set in GameOptions' });
      }

      let gameID = opts.gameID ?? null;
      if (NHL_API_BASE) {
        try {
          const today = getToday();
          const schedule = await fetchSchedule(today);
          const found = findChampionGame(schedule, champion, today);
          gameID = found || null;
          await setGameId(gameID);
        } catch (err) {
          console.error('schedule lookup failed', err);
        }
      }

      return response(event, 200, { champion, gameID });
    }

    if (path === '/gameid' && method === 'GET') {
      const opts = await getGameOptions();
      return response(event, 200, { gameID: opts.gameID ?? null });
    }

    // ---- Draft ----
    if (path === '/draft/state' && method === 'GET') {
      const state = await ensureDraftState();
      return response(event, 200, state);
    }

    if (path === '/draft/state' && method === 'PATCH') {
      const patch = parseBody(event.body);
      const state = await updateDraftState(patch);
      return response(event, 200, state);
    }

    if (path === '/draft/select-team' && method === 'POST') {
      const { playerId, team } = parseBody(event.body);
      if (!playerId || !team) {
        return response(event, 400, { error: 'playerId and team are required' });
      }
      const updated = await updatePlayerTeams(coerceId(playerId), team, 'add');
      return response(event, 200, { player: updated, team });
    }

    return response(event, 404, { error: 'Not found', path, method });
  } catch (err) {
    console.error('handler error', err);
    return response(event, 500, { error: 'Internal Server Error', detail: String(err) });
  }
};
