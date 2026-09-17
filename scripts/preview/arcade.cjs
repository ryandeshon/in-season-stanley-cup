// Deliberately isolated, in-memory design review. No proxy and no database client.
const http = require('node:http');
const { spawn } = require('node:child_process');
const fixture = require('../../cypress/fixtures/cup-day-multiple-games.json');
const state = structuredClone(fixture);
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
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8090');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, 'http://localhost:8091');
  const path = url.pathname;
  let body;
  if (req.method === 'POST' && path === '/preview') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 4096) {
        res.writeHead(413);
        res.end('{}');
        return;
      }
    }
    try {
      const command = JSON.parse(raw);
      const game = state.gameInfoResponse;
      if (command.action === 'goal-home') game.homeTeam.score++;
      else if (command.action === 'goal-away') game.awayTeam.score++;
      else if (command.action === 'final') {
        game.gameState = 'FINAL';
        game.gameOutcome = {
          lastPeriodType: command.decision === 'SO' ? 'SO' : 'REG',
        };
      } else if (command.action === 'shutout') {
        game.awayTeam.score = 0;
        game.homeTeam.score = 3;
        game.gameState = 'FINAL';
        game.gameOutcome = { lastPeriodType: 'REG' };
      } else if (command.action === 'live') {
        game.gameState = 'LIVE';
        game.clock.inIntermission = false;
      } else if (command.action === 'intermission')
        game.clock.inIntermission = !game.clock.inIntermission;
      else if (command.action === 'reset')
        Object.assign(state, structuredClone(fixture));
      else if (command.action === 'owners') {
        const names = ['Ryan', 'Cooper', 'Boz', 'Terry'];
        if (!names.includes(command.left) || !names.includes(command.right))
          throw Error('Invalid owner');
        state.playersResponse.forEach(
          (p) => (p.teams = p.teams.filter((t) => !['BOS', 'TOR'].includes(t)))
        );
        state.playersResponse
          .find((p) => p.name === command.left)
          .teams.push('BOS');
        state.playersResponse
          .find((p) => p.name === command.right)
          .teams.push('TOR');
      } else throw Error('Unknown command');
      body = { ok: true };
    } catch {
      res.statusCode = 400;
      body = { error: 'Invalid preview command' };
    }
  } else if (req.method !== 'GET') {
    res.statusCode = 405;
    body = { error: 'Review preview is read only' };
  } else if (path === '/api/seasons') body = catalog;
  else if (path === '/api/champion') body = state.championResponse;
  else if (path === '/api/gameid') body = state.gameIdResponse;
  else if (path === '/api/season/meta')
    body = {
      ...state.seasonMetaResponse,
      seasonId: url.searchParams.get('season'),
      seasonOver: url.searchParams.get('season') !== 'season3',
    };
  else if (path === '/api/champion/history')
    body = {
      ...state.championHistoryResponse,
      seasonId: url.searchParams.get('season'),
    };
  else if (path === '/api/players') body = state.playersResponse;
  else if (path.startsWith('/api/players/'))
    body =
      state.playersResponse.find(
        (p) => p.name === decodeURIComponent(path.split('/').pop())
      ) || null;
  else if (path === '/api/game-records') body = state.gameRecordsResponse;
  else if (/^\/nhl\/gamecenter\/\d+\/boxscore$/.test(path))
    body = state.gameInfoResponse;
  else if (path.startsWith('/nhl/schedule/')) body = state.scheduleResponse;
  else {
    res.statusCode = 404;
    body = { error: 'No preview fixture for this route' };
  }
  res.end(JSON.stringify(body));
});
server.listen(8091, '127.0.0.1', () =>
  console.log('Isolated review API on localhost:8091')
);
const app = spawn(
  process.execPath,
  [
    require.resolve('@vue/cli-service/bin/vue-cli-service.js'),
    'serve',
    '--mode',
    'cypress',
    '--port',
    '8090',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VUE_APP_HOSTED_ARCADE_PREVIEW: 'false',
      VUE_APP_API_BASE: 'http://localhost:8091/api',
      VUE_APP_NHL_API_URL: 'http://localhost:8091/nhl',
      VUE_APP_WEB_SOCKET_URL: '',
      VUE_APP_ASSET_BASE_URL: '',
      VUE_APP_ENABLE_SEASON_CONTRACTS: 'true',
      VUE_APP_ARCADE_PREVIEW: 'true',
    },
  }
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    app.kill(signal);
    server.close();
  });
app.on('exit', (code) => {
  server.close();
  process.exitCode = code ?? 1;
});
