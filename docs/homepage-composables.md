# Home Page Composables

This document defines the Home page composable boundaries introduced for issue `#17`.

## `useCupGameState`
- Responsibility: Manage champion/game identity, live game state transforms, winner/loser resolution, and avatar mood state.
- Inputs:
  - `findPlayerByTeam(teamAbbrev)`
- Outputs:
  - State refs used by `HomePage.vue` (`currentChampion`, `todaysGame`, `isGameToday`, `isGameOver`, `isGameLive`, etc.)
  - Display computed values (`clockTime`, `period`, avatar types)
  - Methods: `refreshChampionAndGameState`, `getGameInfo`, `applyGameUpdate`, `setLifecycleHandlers`, `getQuote`

## `useLiveGameFeed`
- Responsibility: Handle WebSocket updates, stale-data polling fallback, champion refresh interval, and tab-visibility refresh.
- Inputs:
  - Refs: `cupGameId`, `selectedGameId`, `isGameToday`, `isGameOver`, `lastLiveUpdateAt`
  - Methods: `getGameInfo`, `applyGameUpdate`, `refreshChampionAndGameState`
- Outputs:
  - State refs: `isDisconnected`
  - Methods: `initLiveFeed`, `startPolling`, `stopPolling`, `startChampionRefresh`, `stopChampionRefresh`, `setupVisibilityRefresh`, `clearVisibilityRefresh`

## `useUpcomingMatchups`
- Responsibility: Manage all schedule-based matchup views (off-day possible matchups, cup-day conditional matchups, matchup options list).
- Inputs:
  - Refs: `todaysGame`, `todaysWinner`, `cupGameId`, `selectedGameId`, `playerChampion`, `playerChallenger`
  - `findPlayerByTeam(teamAbbrev)`
- Outputs:
  - State refs: `possibleMatchUps`, `potentialLoading`, `selectedWinnerRole`, `conditionalMatchups`, `conditionalMatchupsLoading`, `matchupOptions`
  - Computed values: `firstGameNonChampionTeam`, `conditionalMatchupsHeading`
  - Methods: `loadMatchupOptions`, `handleWinnerSelection`, `getPossibleMatchUps`, `resetConditionalMatchups`

