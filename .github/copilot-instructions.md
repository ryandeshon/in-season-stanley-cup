# In-Season Stanley Cup - AI Coding Instructions

## Project Overview

A Vue 3 fantasy hockey app tracking daily "championship" matches between NHL teams. Players draft teams, and the current champion's team must defend against opponents nightly. The app features multi-season support, real-time game updates via WebSocket, and player avatars with emotional states.

## Architecture

### Tech Stack

- **Frontend**: Vue 3 (Composition API), Vuetify 3, Tailwind CSS, Vue Router 4, Pinia
- **Backend**: AWS (DynamoDB, Lambda, API Gateway WebSocket)
- **Build**: Vue CLI 5 with Babel, ESLint + Prettier
- **APIs**: NHL API (via proxy)

### Key Directories

- `src/pages/` - Route pages (HomePage, StandingsPage, PlayerProfile, GamePage, DraftPage)
- `src/components/` - Reusable UI (PlayerCard, TeamLogo, NavigationBar)
- `src/composables/` - Vue composables for data fetching (useSeasonData, usePlayerSeasonData, useTheme)
- `src/services/` - External integrations (nhlApi, dynamodbService, socketClient, Lambda functions)
- `src/store/` - Pinia stores (seasonStore, themeStore)
- `src/assets/players/season[1|2]/` - Player avatar images organized by season and emotional state

## Critical Patterns

### Multi-Season Architecture

The app supports switching between seasons (season1, season2) using `seasonStore`:

```javascript
// Always use seasonStore getters for table names and paths
const seasonStore = useSeasonStore();
seasonStore.playersTableName; // 'Players-Season1' or 'Players'
seasonStore.gameRecordsTableName; // 'GameRecords-Season1' or 'GameRecords'
seasonStore.playerImagesPath; // 'season1' or 'season2'
```

Never hardcode table names or asset paths. The store handles localStorage persistence and provides reactive getters.

### Theming System

Four dynamic themes based on season + light/dark mode:

- `season1-light`, `season1-dark`, `season2-light`, `season2-dark`
- Theme computed in `App.vue` via `currentThemeName`
- Vuetify themes defined in `src/plugins/vuetify.js`
- Custom CSS variables in `src/assets/_variables.css`
- Use `useTheme()` composable for accessing `isDarkTheme` and `isDarkOrLight`

### Player Avatar System

PlayerCard displays context-aware avatars:

- **Image Types**: `normal`, `happy`, `sad`, `angry`, `anguish`, `mirror`
- **Location**: `src/assets/players/season[1|2]/{player}-{emotion}.png`
- **Pattern**: Import all images statically in `PlayerCard.vue` (no dynamic require)

```javascript
// Example: PlayerCard uses getImage() function with season detection
getImage(playerName, imageType); // Returns correct season-specific image
```

### Data Fetching with Composables

Use `useSeasonData()` for data that must reload on season change:

```javascript
const { players, gameRecords, loading, fetchSeasonData } = useSeasonData();
watch(
  () => seasonStore.currentSeason,
  () => fetchSeasonData()
);
```

Composables handle season-aware DynamoDB queries via `dynamodbService.js`.

### Real-Time Updates

WebSocket connection via `socketClient.js`:

```javascript
initSocket({
  onMessage: (data) => {
    /* handle game updates */
  },
});
```

- Handles automatic reconnection (max 10 attempts)
- Use `sendSocketMessage(action, payload)` to send
- Required env var: `VUE_APP_WEB_SOCKET_URL`

## Development Workflow

### Environment Setup

1. Copy `.env.example` to `.env` and configure:
   - `VUE_APP_API_BASE` (prod HTTP API base URL from API Gateway)
   - `VUE_APP_NHL_API_URL` (NHL API proxy endpoint)
   - `VUE_APP_WEB_SOCKET_URL` (WebSocket endpoint)
   - No AWS access keys are required in the client; Lambdas run with IAM roles.

### Commands

- `yarn serve` - Dev server with hot reload
- `yarn build` - Production build
- `yarn lint` / `yarn lint:fix` - ESLint + Prettier formatting

### Code Style

- **Vue 3 Composition API** with `<script setup>` syntax
- **Props**: Use `defineProps()` with object syntax
- **Imports**: Organize as: Vue → libraries → composables → services → components → assets
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Tailwind**: Prefer Tailwind utilities over custom CSS; Vuetify for complex components

## Data Model

### DynamoDB Tables

- **Players** / **Players-Season1**: Player records with `name` (key), `teams` (array), `titleDefenses` (number)
- **GameRecords** / **GameRecords-Season1**: Historical game results with `id`, `wTeam`, `wScore`, `lTeam`, `lScore`
- **GameOptions**: Current game state with `currentChampion`, `gameID`

Access via `dynamodbService.js` functions:

- `getAllPlayers()` - Scan all players (season-aware)
- `getPlayerData(name)` - Query by name using NameIndex
- `getGameRecords()` - Scan all game records (season-aware)

### NHL API Integration

Service at `src/services/nhlApi.js` provides:

- `getSchedule(date)` - Schedule for YYYY-MM-DD
- `getGameInfo(gameId)` - Live boxscore data
- Uses axios with configured base URL

## Common Tasks

### Adding a New Player

1. Add to DynamoDB Players table
2. Create avatar images in `src/assets/players/season[X]/`: `{name}-normal.png`, `{name}-happy.png`, `{name}-sad.png`, `{name}-angry.png`
3. Import images in `PlayerCard.vue` following existing pattern
4. Update `getImage()` function with new player cases

### Adding Season 3

1. Update `seasonStore.js` state with `season3` option
2. Update getters for new table names
3. Create `src/assets/players/season3/` directory
4. Add `season3-light` and `season3-dark` themes to `vuetify.js`
5. Update theme computation logic in `App.vue`

### Modifying Game Logic

Game state managed in Lambda functions:

- `checkChampionsLambda.js` - Determines daily matchup
- `checkGameLambda.js` - Monitors live games and updates champion
- `lambda-broadcast/index.mjs` - WebSocket broadcasting to clients

### Working with Routes

Router at `src/router/index.js`:

- Dynamic routes use `props: true` to pass params as props
- Draft page: `/draft/:name?` (optional name param)
- Player profile: `/player/:name`
- Game details: `/game/:id`

## Troubleshooting

- **Theme not updating**: Check `App.vue` watchers and Vuetify theme name assignment
- **Images not loading**: Verify season-specific imports in PlayerCard and file paths
- **DynamoDB errors**: Confirm `.env` credentials and table names match seasonStore getters
- **WebSocket not connecting**: Check `VUE_APP_WEB_SOCKET_URL` and Lambda WebSocket API deployment
- **Build errors**: Run `yarn lint:fix` to auto-fix ESLint/Prettier issues
