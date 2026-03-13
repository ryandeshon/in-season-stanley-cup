import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { DateTime } from 'luxon';
import nhlApi from '@/services/nhlApi';
import { useCurrentSeasonData } from '@/composables/useCurrentSeasonData';
import { getCurrentChampion, getGameId } from '@/services/championServices';
import { useLiveGameFeed } from '@/composables/useLiveGameFeed';
import { useUpcomingMatchups } from '@/composables/useUpcomingMatchups';

const CHAMPION_REFRESH_MS = 5 * 60 * 1000;

/**
 * useCupGameState
 * Responsibility: orchestrate home page game-day/off-day state by composing
 * champion/game bootstrap, live feed behavior, and matchup projections.
 *
 * Inputs:
 * - none (uses current-season player data and app services internally).
 *
 * Outputs:
 * - Home page state refs/computeds used by `HomePage.vue`.
 * - UI actions: `handleWinnerSelection`, `getTeamOwnerName`.
 */
export function useCupGameState() {
  const { players: allPlayersData, error: seasonDataError } =
    useCurrentSeasonData();

  const loading = ref(true);
  const homeError = ref('');
  const currentChampion = ref(null);
  const localStartTime = ref(null);
  const todaysGame = ref({});
  const todaysWinner = ref({});
  const todaysLoser = ref({});
  const playerChampion = ref({});
  const playerChallenger = ref({});
  const isGameToday = ref(false);
  const isGameOver = ref(false);
  const isGameLive = ref(false);
  const isSeasonOver = ref(false);
  const isMirrorMatch = ref(false);
  const gameID = ref(null);
  const cupGameId = ref(null);
  const selectedGameId = ref(null);
  const matchupOptions = ref([]);
  const matchupOptionsLoading = ref(false);

  let championRefreshIntervalId = null;
  let visibilityHandlerBound = null;

  const playersList = computed(() =>
    Array.isArray(allPlayersData.value) ? allPlayersData.value : []
  );

  const homeErrorMessage = computed(() => {
    if (homeError.value) return homeError.value;
    if (seasonDataError.value) {
      return 'Player data is unavailable right now. Team owners may appear as Unknown.';
    }
    return '';
  });

  function findPlayerByTeam(teamAbbrev) {
    if (!teamAbbrev) return undefined;
    return playersList.value.find(
      (player) =>
        Array.isArray(player?.teams) && player.teams.includes(teamAbbrev)
    );
  }

  function getTeamOwner(teamAbbrev) {
    return findPlayerByTeam(teamAbbrev);
  }

  function getTeamOwnerName(teamAbbrev) {
    return getTeamOwner(teamAbbrev)?.name || 'Unknown';
  }

  const upcomingMatchups = useUpcomingMatchups({
    todaysGame,
    todaysWinner,
    playerChampion,
    playerChallenger,
    findPlayerByTeam,
  });

  async function refreshChampionAndGameState(options = {}) {
    try {
      const [champion, activeGameId] = await Promise.all([
        getCurrentChampion(options),
        getGameId(options),
      ]);
      homeError.value = '';
      currentChampion.value = champion;
      gameID.value = activeGameId;
      cupGameId.value = activeGameId;
      if (!selectedGameId.value || options?.forceGameSelectionReset) {
        selectedGameId.value = activeGameId;
      }
    } catch (error) {
      homeError.value =
        'Unable to refresh champion/game status right now. Retrying automatically.';
      console.error('Error refreshing champion/game state:', error);
    }
  }

  async function getGameInfo(
    targetGameId = selectedGameId.value || cupGameId.value
  ) {
    if (!targetGameId) return;

    try {
      const result = await nhlApi.getGameInfo(targetGameId);
      applyGameUpdate(result.data);
      homeError.value = '';
    } catch (error) {
      homeError.value =
        'Live game details are temporarily unavailable. Showing last known state.';
      console.error('Error fetching game result:', error);
    } finally {
      loading.value = false;
    }
  }

  function buildMatchupLabel(game, defaultGameId) {
    const awayTeam = game?.awayTeam?.abbrev || 'AWAY';
    const homeTeam = game?.homeTeam?.abbrev || 'HOME';
    const isCupMatchup = String(game?.id) === String(defaultGameId);
    return `${awayTeam} @ ${homeTeam}${isCupMatchup ? ' (Cup Defense)' : ''}`;
  }

  async function loadMatchupOptions() {
    if (!cupGameId.value) {
      matchupOptions.value = [];
      return;
    }

    matchupOptionsLoading.value = true;
    const scheduleDate = todaysGame.value.startTimeUTC
      ? DateTime.fromISO(todaysGame.value.startTimeUTC).toFormat('yyyy-MM-dd')
      : DateTime.now().toFormat('yyyy-MM-dd');

    try {
      const scheduleData = await nhlApi.getSchedule(scheduleDate);
      const gameWeek = scheduleData?.data?.gameWeek || [];
      const datedGames = gameWeek
        .filter((entry) => entry?.date === scheduleDate)
        .flatMap((entry) => entry?.games || []);
      const currentDayGames = datedGames.length
        ? datedGames
        : gameWeek.flatMap((entry) => entry?.games || []);
      const cupGame = currentDayGames.find(
        (game) => String(game.id) === String(cupGameId.value)
      );
      matchupOptions.value = cupGame
        ? [
            {
              id: String(cupGame.id),
              label: buildMatchupLabel(cupGame, cupGameId.value),
            },
          ]
        : [];

      if (!matchupOptions.value.length) {
        matchupOptions.value = [
          {
            id: String(cupGameId.value),
            label: `Cup Matchup (${cupGameId.value})`,
          },
        ];
      }
    } catch (err) {
      console.error('Failed to load game-day matchups', err);
      matchupOptions.value = [
        {
          id: String(cupGameId.value),
          label: `Cup Matchup (${cupGameId.value})`,
        },
      ];
    } finally {
      selectedGameId.value = String(
        selectedGameId.value ||
          matchupOptions.value.find(
            (option) => String(option.id) === String(cupGameId.value)
          )?.id ||
          matchupOptions.value[0]?.id ||
          cupGameId.value
      );
      matchupOptionsLoading.value = false;
    }
  }

  function getTeamsInfo(gameData = todaysGame.value) {
    const homeTeam = gameData.homeTeam;
    const awayTeam = gameData.awayTeam;
    const championIsHome = currentChampion.value === homeTeam?.abbrev;
    const championIsAway = currentChampion.value === awayTeam?.abbrev;

    if (!championIsHome && !championIsAway) {
      return false;
    }

    const championTeam = championIsHome ? homeTeam : awayTeam;
    const challengerTeam = championIsHome ? awayTeam : homeTeam;

    const championPlayer =
      findPlayerByTeam(championTeam?.abbrev) || playerChampion.value || {};

    const challengerPlayer =
      findPlayerByTeam(challengerTeam?.abbrev) || playerChallenger.value || {};

    playerChampion.value = { ...championPlayer, championTeam };
    playerChallenger.value = { ...challengerPlayer, challengerTeam };

    isMirrorMatch.value =
      playerChampion.value?.name === playerChallenger.value?.name;

    return true;
  }

  function setGameOutcome(gameData) {
    const homeTeam = gameData.homeTeam;
    const awayTeam = gameData.awayTeam;
    if (!homeTeam || !awayTeam) return;

    const winnerTeam = homeTeam.score > awayTeam.score ? homeTeam : awayTeam;
    const loserTeam = winnerTeam === homeTeam ? awayTeam : homeTeam;

    todaysWinner.value = {
      ...winnerTeam,
      player: findPlayerByTeam(winnerTeam.abbrev),
    };
    todaysLoser.value = {
      ...loserTeam,
      player: findPlayerByTeam(loserTeam.abbrev),
    };
  }

  function applyGameUpdate(gameData) {
    if (!gameData) return;

    const wasGameOver = isGameOver.value;
    todaysGame.value = gameData;
    liveGameFeed.recordGameUpdate(gameData);
    isGameOver.value = ['FINAL', 'OFF'].includes(gameData.gameState);
    isGameLive.value = ['LIVE', 'CRIT'].includes(gameData.gameState);

    if (gameData.startTimeUTC) {
      localStartTime.value = DateTime.fromISO(
        gameData.startTimeUTC
      ).toLocaleString(DateTime.DATETIME_FULL);
    }

    const championPlaying = getTeamsInfo(gameData);

    if (!championPlaying) {
      upcomingMatchups.resetConditionalMatchups();
      isGameToday.value = false;
      playerChampion.value = findPlayerByTeam(currentChampion.value) || {};
      upcomingMatchups.getPossibleMatchUps(currentChampion.value);
      liveGameFeed.stopPolling();
      return;
    }

    isGameToday.value = true;

    if (isGameOver.value) {
      upcomingMatchups.resetConditionalMatchups();
      setGameOutcome(gameData);
      if (!wasGameOver) {
        refreshChampionAndGameState({ bustCache: true });
      }
      upcomingMatchups.getPossibleMatchUps(todaysWinner.value.abbrev);
      liveGameFeed.stopPolling();
    } else {
      liveGameFeed.startPolling();
    }
  }

  const liveGameFeed = useLiveGameFeed({
    todaysGame,
    currentChampion,
    isGameToday,
    isGameOver,
    isGameLive,
    selectedGameId,
    cupGameId,
    getGameInfo,
    onGameUpdate: applyGameUpdate,
  });

  function startChampionRefresh() {
    if (championRefreshIntervalId) return;
    championRefreshIntervalId = setInterval(() => {
      refreshChampionAndGameState({ bustCache: true });
    }, CHAMPION_REFRESH_MS);
  }

  function stopChampionRefresh() {
    if (championRefreshIntervalId) {
      clearInterval(championRefreshIntervalId);
      championRefreshIntervalId = null;
    }
  }

  onMounted(async () => {
    if (isSeasonOver.value) {
      loading.value = false;
      return;
    }

    try {
      await refreshChampionAndGameState();
    } catch (error) {
      console.error('Error fetching getCurrentChampion or getGameId:', error);
    }

    startChampionRefresh();
    visibilityHandlerBound = () => {
      if (document.visibilityState === 'visible') {
        refreshChampionAndGameState({ bustCache: true });
      }
    };
    document.addEventListener('visibilitychange', visibilityHandlerBound);

    isGameToday.value = gameID.value !== null;
    if (isGameToday.value) {
      await getGameInfo(cupGameId.value);
      await loadMatchupOptions();
      liveGameFeed.startLiveFeed();
    } else {
      matchupOptions.value = [];
      playerChampion.value = findPlayerByTeam(currentChampion.value) || {};
      upcomingMatchups.getPossibleMatchUps(currentChampion.value);
      loading.value = false;
    }
  });

  onBeforeUnmount(() => {
    stopChampionRefresh();
    if (visibilityHandlerBound) {
      document.removeEventListener('visibilitychange', visibilityHandlerBound);
      visibilityHandlerBound = null;
    }
  });

  return {
    loading,
    homeErrorMessage,
    currentChampion,
    localStartTime,
    todaysGame,
    todaysWinner,
    todaysLoser,
    playerChampion,
    playerChallenger,
    isGameToday,
    isGameOver,
    isGameLive,
    isSeasonOver,
    isMirrorMatch,
    matchupOptions,
    matchupOptionsLoading,
    getTeamOwnerName,
    ...upcomingMatchups,
    ...liveGameFeed,
  };
}
