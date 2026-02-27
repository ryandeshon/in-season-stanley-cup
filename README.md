# In Season Stanley Cup

A Vue 3 app that tracks a season-long “In Season Cup” between NHL teams, where a
single “champion” team defends the cup daily and players earn points based on
their drafted teams’ results.

This README focuses on how the app is built, how data flows, and how to run it
locally.

## What the app does
- Shows today’s champion matchup (or next possible matchups if the champion is
  idle).
- Displays the current champion, live scores, and end-of-game results.
- Tracks season standings by player based on title defenses.
- Provides player profile pages with team records and game history.
- Includes a live, real-time draft experience (player view + admin view).

## Tech stack
- Vue 3 + Vue Router
- Pinia for state
- Vuetify 3 + Tailwind for UI
- Luxon for dates
- Axios + fetch for HTTP
- AWS backend (API Gateway + Lambda + DynamoDB + WebSockets)

## App structure (quick map)
- `src/main.js` boots the app, registers Pinia/Router/Vuetify, and syncs theme.
- `src/router/index.js` defines top-level routes.
- `src/pages/*` are the main screens (Home, Standings, Game, Draft, etc.).
- `src/components/*` are reusable UI blocks (nav, player cards, team logos).
- `src/composables/*` encapsulate data fetching for season/player pages.
- `src/services/*` talk to NHL API, backend API, and WebSocket.
- `lambdas/*` contains AWS Lambda backends (HTTP API + scheduled game check).
- `amplify/*` holds Amplify project configuration (if deployed via Amplify).

## Local setup
Install dependencies:
```bash
yarn install
```

Run the app:
```bash
yarn serve
```

Build for production:
```bash
yarn build
```

Lint:
```bash
yarn lint
```

### End-to-end tests
- Headless: `npm run test:e2e` (or `yarn test:e2e`)
- Interactive: `npm run test:e2e:open` (or `yarn test:e2e:open`)

More details on fixtures, stubbing, and CI are in `docs/testing.md`.

## Environment variables
Create a `.env.local` file at the repo root with:
```bash
VUE_APP_API_BASE=<your-api-gateway-base-url>
VUE_APP_NHL_API_URL=<nhl-api-base-or-proxy>
VUE_APP_WEB_SOCKET_URL=<websocket-url>
```

### Caching and deployment
- Asset and API caching guidance (CloudFront + S3 + Lambda headers) lives in `docs/caching.md`.
- AWS rollout details, resource IDs, verification commands, and rollback steps live in `docs/aws-cache-rollout-runbook.md`.
- Vue build output already emits hashed filenames; serve built assets from an edge cache (e.g., CloudFront) with long-lived `Cache-Control` headers and short TTLs for HTML.

### AI workflow and security
- AI project workflow and templates: `ai/README.md`
- AI security guardrails (public repo safety checklist): `ai/SECURITY.md`
- AI best-practice guide for this repo: `ai/BEST_PRACTICES.md`
- New project planning convention:
  - `ai/project/<name-of-project>/SPEC.md`
  - `ai/project/<name-of-project>/BACKLOG.md`
- Local security scan command:
  - `yarn security:audit`

### Public repo safety note
- Do not commit `amplify/team-provider-info.json` (ignored by default).
- Use `amplify/team-provider-info.example.json` as the public template.

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

Notes:
- `VUE_APP_API_BASE` is required for players, game records, champion info, and
  draft state. Without it, most pages will show loading errors.
- `VUE_APP_NHL_API_URL` is used by `src/services/nhlApi.js` to pull schedules,
  scores, standings, and boxscores.
- `VUE_APP_WEB_SOCKET_URL` enables real-time updates (live games + draft).
  If unset, the app will fall back to polling for game updates.

## How the app works (data flow)

### 1) Champion + game selection
- The backend stores the current champion team and (optionally) today’s game ID
  in the `GameOptions` table under key `currentChampion`.
- The frontend calls:
  - `GET /champion` → `{ champion, gameID }`
  - `GET /gameid` → `{ gameID }`
- The `GET /champion` endpoint can compute today’s game automatically by
  querying the NHL schedule and updating `gameID` in DynamoDB.

### 2) Home page (live game flow)
File: `src/pages/HomePage.vue`
- Fetches `champion` and `gameID` from the backend.
- If there is a game today:
  - Fetches the NHL boxscore via `nhlApi.getGameInfo(gameID)`.
  - Connects to WebSocket for `liveGameUpdate` messages.
  - Starts a 30s poll as a fallback if live updates go stale.
  - Picks avatars based on score state (happy/angry/anguish).
- If no game today:
  - Shows the champion and possible next matchups using the NHL schedule.

### 3) Standings
File: `src/pages/StandingsPage.vue`
- `useSeasonData()` loads all players + game records from the backend.
- Players are sorted by `titleDefenses`.
- Fetches the current champion to show a crown icon next to the owner.
- Shows a season progress bar based on game record count.

### 4) Player profile
File: `src/pages/PlayerProfile.vue`
- `usePlayerSeasonData(name)` loads:
  - Player data
  - Game records
- Computes win/loss records per team and renders a paged game history.
- “Mirror match” (same player owns both teams) is handled explicitly.

### 5) Game details
File: `src/pages/GamePage.vue`
- Uses NHL API boxscore for a specific `gameId` route param.
- Shows full team and goalie stats if game is not future (`gameState !== FUT`).

### 6) Draft (player + admin)
Files:
- `src/pages/DraftPage.vue`
- `src/pages/DraftAdminPage.vue`

Data flow:
- Uses backend endpoints:
  - `GET /draft/state`
  - `PATCH /draft/state`
  - `POST /draft/select-team`
  - `POST /players/reset-teams` (admin only)
- Uses WebSocket messages of type `draftUpdate` to update all clients.
- Draft “current picker” logic is server-driven; client just renders and reacts.

## Theming + season selection
Season state lives in `src/store/seasonStore.js` and is persisted to
`localStorage` as `selectedSeason`. It controls:
- Visual theme (`season1` vs `season2`, plus light/dark).
- Player/avatar assets and team logo source.

Note: The backend API doesn’t currently take a season parameter. The season
selector affects UI/branding and local assets; data remains whatever the API
serves.

## Backend API (Lambda)
File: `lambdas/http-api/index.js`

### Endpoints
```
GET    /players
GET    /players/:name
POST   /players/reset-teams
PATCH  /players/:id/teams

GET    /game-records

GET    /champion
GET    /gameid

GET    /draft/state
PATCH  /draft/state
POST   /draft/select-team
```

### Key DynamoDB tables
- `Players` (player profiles, teams, title defenses, etc.)
- `GameRecords` (per-game win/loss records)
- `GameOptions` (current champion + draft state)
- `SocketConnections` (WebSocket connections for live updates)

### Lambda config env vars
Used by `lambdas/http-api/index.js`:
```
AWS_REGION
PLAYERS_TABLE
GAME_RECORDS_TABLE
GAME_OPTIONS_TABLE
DRAFT_STATE_ID
CORS_ORIGIN
NHL_API_BASE
NHL_TEAMS
```

Used by `lambdas/check-game/index.js`:
```
AWS_REGION
GAME_OPTIONS_TABLE
GAME_OPTIONS_KEY
GAME_ID_FIELD
PLAYERS_TABLE
GAME_RECORDS_TABLE
NHL_API_BASE
```

## Scheduled game checker
File: `lambdas/check-game/index.js`

Purpose:
- Reads `gameID` from `GameOptions`.
- Fetches NHL boxscore.
- If game is final:
  - Writes a game record to `GameRecords`.
  - Updates `champion` in `GameOptions`.
  - Increments `titleDefenses` and `totalDefenses` for the winning player.
  - Clears `gameID` to avoid reprocessing.

## WebSocket live updates
File: `src/services/socketClient.js`

Behavior:
- Connects to `VUE_APP_WEB_SOCKET_URL`.
- Receives messages such as:
  - `{ type: "liveGameUpdate", payload: <boxscore> }`
  - `{ type: "draftUpdate", payload: <draftState> }`
- Auto-reconnects with a capped retry loop.

Optional broadcaster:
- `src/services/lambda-broadcast/index.mjs` is a Lambda-style script that:
  - Reads current game ID from DynamoDB.
  - Pulls the latest boxscore.
  - Pushes to every connection in `SocketConnections`.
  - It’s not part of the Vue build; deploy separately if you use it.

## NHL API usage
The NHL data comes from `https://api-web.nhle.com/v1` (or a proxy set via
`VUE_APP_NHL_API_URL`) and includes:
- Schedule (`/schedule/{date}`)
- Standings (`/standings/now`)
- Scores (`/score/now`)
- Game boxscore (`/gamecenter/{gameId}/boxscore`)

## Notes / gotchas
- `src/services/dynamodbService.js` is a frontend API client (not raw DynamoDB).
- `src/store/index.js` is legacy and not used by the current app entry.
- The season selector does not change backend data unless the API is built to
  do so.

## License
See `LICENSE`.
