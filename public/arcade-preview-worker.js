/* Test-only, browser-local fixture API. No database, production proxy or write fallback. */
const PREFIX = '/__arcade-preview';
let state;
let loading;
const catalog = {
  storageVersion: 'v2',
  defaultSeason: 'season3',
  seasons: [
    { id: 'season1', label: 'Season 1', status: 'archived' },
    { id: 'season2', label: 'Season 2', status: 'archived' },
    {
      id: 'season3',
      label: 'Season 3',
      status: 'active',
      writersEnabled: false,
    },
  ],
};
self.addEventListener('install', (event) =>
  event.waitUntil(self.skipWaiting())
);
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim())
);
const CACHE = 'isc-arcade-review-v1';
const STATE_KEY = '/__arcade-preview/saved-fixture';
let original;
async function pristine() {
  original ||= fetch('/arcade-preview-fixture.json').then((response) => {
    if (!response.ok) throw Error('Fixture unavailable');
    return response.json();
  });
  return original;
}
async function fixture() {
  loading ||= (async () => {
    const cached = await (await caches.open(CACHE)).match(STATE_KEY);
    return cached ? cached.json() : structuredClone(await pristine());
  })();
  state ||= await loading;
  return state;
}
async function save() {
  await (await caches.open(CACHE)).put(STATE_KEY, json(state));
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
async function respond(request, url) {
  try {
    const data = await fixture();
    const path = url.pathname.slice(PREFIX.length);
    if (request.method === 'POST' && path === '/preview') {
      const command = await request.json();
      const game = data.gameInfoResponse;
      if (command.action === 'goal-home') game.homeTeam.score++;
      else if (command.action === 'goal-away') game.awayTeam.score++;
      else if (command.action === 'live') {
        game.gameState = 'LIVE';
        game.clock.inIntermission = false;
      } else if (command.action === 'intermission')
        game.clock.inIntermission = !game.clock.inIntermission;
      else if (command.action === 'final') {
        game.gameState = 'FINAL';
        game.gameOutcome = { lastPeriodType: 'REG' };
      } else if (command.action === 'shutout') {
        game.homeTeam.score = 3;
        game.awayTeam.score = 0;
        game.gameState = 'FINAL';
        game.gameOutcome = { lastPeriodType: 'REG' };
      } else if (command.action === 'reset')
        state = structuredClone(await pristine());
      else if (command.action === 'owners') {
        if (
          !['Ryan', 'Cooper', 'Boz', 'Terry'].includes(command.left) ||
          !['Ryan', 'Cooper', 'Boz', 'Terry'].includes(command.right)
        )
          return json({ error: 'Invalid owner' }, 400);
        data.playersResponse.forEach(
          (p) => (p.teams = p.teams.filter((t) => !['BOS', 'TOR'].includes(t)))
        );
        data.playersResponse
          .find((p) => p.name === command.left)
          .teams.push('BOS');
        data.playersResponse
          .find((p) => p.name === command.right)
          .teams.push('TOR');
      } else return json({ error: 'Unknown preview action' }, 400);
      await save();
      return json({ ok: true });
    }
    if (request.method !== 'GET')
      return json({ error: 'Preview is read only' }, 405);
    if (path === '/api/seasons') return json(catalog);
    if (path === '/api/champion') return json(data.championResponse);
    if (path === '/api/gameid') return json(data.gameIdResponse);
    if (path === '/api/season/meta')
      return json({
        ...data.seasonMetaResponse,
        seasonId: url.searchParams.get('season'),
        seasonOver: url.searchParams.get('season') !== 'season3',
      });
    if (path === '/api/champion/history')
      return json({
        ...data.championHistoryResponse,
        seasonId: url.searchParams.get('season'),
      });
    if (path === '/api/players') return json(data.playersResponse);
    if (path.startsWith('/api/players/'))
      return json(
        data.playersResponse.find(
          (p) => p.name === decodeURIComponent(path.split('/').pop())
        ) || null
      );
    if (path === '/api/game-records') return json(data.gameRecordsResponse);
    if (/^\/nhl\/gamecenter\/\d+\/boxscore$/.test(path))
      return json(data.gameInfoResponse);
    if (path.startsWith('/nhl/schedule/')) return json(data.scheduleResponse);
    return json({ error: 'No fixture for this route' }, 404);
  } catch {
    return json(
      { error: 'Preview data unavailable. Reload to try again.' },
      503
    );
  }
}
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith(`${PREFIX}/`)
  )
    event.respondWith(respond(event.request, url));
});
