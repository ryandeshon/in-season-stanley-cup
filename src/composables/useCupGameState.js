import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { DateTime } from 'luxon';
import nhlApi from '@/services/nhlApi';
import {
  getCurrentChampion,
  getGameId,
  getSeasonMeta,
  shouldUseContractFallback,
} from '@/services/championServices';
import { useSeasonStore } from '@/store/seasonStore';
import quotes from '@/utilities/quotes.json';
import {
  hasSessionWarning,
  setSessionWarning,
} from '@/utilities/sessionWarnings';

/**
 * Home page game-state orchestration for champion/game identity, current matchup,
 * live score transforms, and avatar mood state.
 *
 * Inputs:
 * - `findPlayerByTeam(teamAbbrev): player | undefined`
 *
 * Outputs:
 * - Reactive game/champion state refs + computed display helpers
 * - `refreshChampionAndGameState`, `getGameInfo`, `applyGameUpdate`
 * - `setLifecycleHandlers` to react to champion-idle/game-over/live transitions
 */
export function useCupGameState({ findPlayerByTeam } = {}) {
  const SEASON_META_CONTRACT_WARNING_KEY = 'home-season-meta-contract-warning';

  const seasonStore = useSeasonStore();
  const resolvePlayerByTeam = (teamAbbrev) =>
    typeof findPlayerByTeam === 'function'
      ? findPlayerByTeam(teamAbbrev)
      : undefined;

  const loading = ref(true);
  const homeError = ref('');
  const currentChampion = ref(null);
  const localStartTime = ref(null);
  const todaysGame = ref({});
  const todaysWinner = ref({});
  const todaysLoser = ref({});
  const playerChampion = ref({});
  const playerChallenger = ref({});
  const secondsRemaining = ref(null);
  const isGameToday = ref(false);
  const isGameOver = ref(false);
  const isGameLive = ref(false);
  const isSeasonOver = ref(false);
  const isMirrorMatch = ref(false);
  const gameID = ref(null);
  const cupGameId = ref(null);
  const selectedGameId = ref(null);
  const lastLiveUpdateAt = ref(0);
  const previousHomeScore = ref(0);
  const previousAwayScore = ref(0);
  const recentGoalAgainst = ref({ home: false, away: false });
  const goalTimers = ref({ home: null, away: null });
  const seasonMetaWarning = ref('');

  const lifecycleHandlers = {
    onChampionNotPlaying: null,
    onGameOver: null,
    onGameInProgress: null,
  };

  function setLifecycleHandlers(handlers = {}) {
    lifecycleHandlers.onChampionNotPlaying =
      handlers.onChampionNotPlaying || null;
    lifecycleHandlers.onGameOver = handlers.onGameOver || null;
    lifecycleHandlers.onGameInProgress = handlers.onGameInProgress || null;
  }

  function withSeasonOptions(options = {}) {
    if (options.season) return options;
    return {
      ...options,
      season: seasonStore.currentSeason,
    };
  }

  const clockTime = computed(() => {
    if (secondsRemaining.value === null || secondsRemaining.value === undefined)
      return '--:--';
    return DateTime.fromSeconds(secondsRemaining.value).toFormat('mm:ss');
  });

  const period = computed(() => {
    if (todaysGame.value.periodDescriptor?.periodType === 'OT') {
      return 'OT';
    }
    return todaysGame.value.periodDescriptor?.number;
  });

  const championAvatarType = computed(() => {
    if (!isGameLive.value) {
      return 'Happy';
    }

    const isChampionHome =
      currentChampion.value === todaysGame.value.homeTeam?.abbrev;
    const championScore = isChampionHome
      ? todaysGame.value.homeTeam?.score
      : todaysGame.value.awayTeam?.score;
    const challengerScore = isChampionHome
      ? todaysGame.value.awayTeam?.score
      : todaysGame.value.homeTeam?.score;

    if (
      (isChampionHome && recentGoalAgainst.value.home) ||
      (!isChampionHome && recentGoalAgainst.value.away)
    ) {
      return 'Anguish';
    }

    return championScore > challengerScore ? 'Happy' : 'Angry';
  });

  const challengerAvatarType = computed(() => {
    if (!isGameLive.value) {
      return 'Happy';
    }

    const isChampionHome =
      currentChampion.value === todaysGame.value.homeTeam?.abbrev;
    const championScore = isChampionHome
      ? todaysGame.value.homeTeam?.score
      : todaysGame.value.awayTeam?.score;
    const challengerScore = isChampionHome
      ? todaysGame.value.awayTeam?.score
      : todaysGame.value.homeTeam?.score;

    if (
      (isChampionHome && recentGoalAgainst.value.away) ||
      (!isChampionHome && recentGoalAgainst.value.home)
    ) {
      return 'Anguish';
    }

    return challengerScore > championScore ? 'Happy' : 'Angry';
  });

  const gameOverWinnerAvatarType = computed(() => 'Happy');
  const gameOverLoserAvatarType = computed(() => 'Sad');

  watch(
    () => todaysGame.value.clock?.secondsRemaining,
    (newVal) => {
      if (newVal !== undefined) {
        secondsRemaining.value = newVal;
      }
    }
  );

  watch(
    () => todaysGame.value.homeTeam?.score,
    (newScore, oldScore) => {
      if (oldScore !== undefined && newScore > oldScore) {
        triggerAnguishAvatar('away');
      }
      previousHomeScore.value = newScore;
    }
  );

  watch(
    () => todaysGame.value.awayTeam?.score,
    (newScore, oldScore) => {
      if (oldScore !== undefined && newScore > oldScore) {
        triggerAnguishAvatar('home');
      }
      previousAwayScore.value = newScore;
    }
  );

  async function refreshChampionAndGameState(options = {}) {
    try {
      const seasonOptions = withSeasonOptions(options);
      const [champion, activeGameId] = await Promise.all([
        getCurrentChampion(seasonOptions),
        getGameId(seasonOptions),
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

  async function refreshSeasonMeta(options = {}) {
    try {
      const seasonMeta = await getSeasonMeta(withSeasonOptions(options));
      isSeasonOver.value = Boolean(seasonMeta?.seasonOver);
      seasonMetaWarning.value = '';
      return seasonMeta;
    } catch (error) {
      isSeasonOver.value = false;
      if (shouldUseContractFallback(error)) {
        if (!hasSessionWarning(SEASON_META_CONTRACT_WARNING_KEY)) {
          setSessionWarning(SEASON_META_CONTRACT_WARNING_KEY);
          seasonMetaWarning.value =
            'Backend season endpoints from this branch are not deployed in this environment yet. Showing live mode by default.';
          console.warn(
            '[home] Using local fallback because /season/meta is unavailable in the current API deployment.'
          );
        } else {
          seasonMetaWarning.value = '';
        }
        return null;
      }
      seasonMetaWarning.value =
        'Season metadata is temporarily unavailable. Showing live mode by default.';
      console.error('Error fetching season metadata:', error);
      return null;
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
      resolvePlayerByTeam(championTeam?.abbrev) || playerChampion.value || {};

    const challengerPlayer =
      resolvePlayerByTeam(challengerTeam?.abbrev) ||
      playerChallenger.value ||
      {};

    playerChampion.value = { ...championPlayer, championTeam };
    playerChallenger.value = { ...challengerPlayer, challengerTeam };

    isMirrorMatch.value =
      playerChampion.value?.name === playerChallenger.value?.name;

    return true;
  }

  function getQuote() {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const selectedQuote = quotes[randomIndex];
    const playerName = todaysLoser.value.player?.name || 'opponent';
    return selectedQuote.replace(/{name}/g, playerName);
  }

  function triggerAnguishAvatar(team) {
    if (goalTimers.value[team]) {
      clearTimeout(goalTimers.value[team]);
    }

    recentGoalAgainst.value[team] = true;

    goalTimers.value[team] = setTimeout(() => {
      recentGoalAgainst.value[team] = false;
      goalTimers.value[team] = null;
    }, 60000);
  }

  function applyGameUpdate(gameData) {
    if (!gameData) return;

    const wasGameOver = isGameOver.value;
    todaysGame.value = gameData;
    secondsRemaining.value = gameData.clock?.secondsRemaining ?? 0;
    isGameOver.value = ['FINAL', 'OFF'].includes(gameData.gameState);
    isGameLive.value = ['LIVE', 'CRIT'].includes(gameData.gameState);
    lastLiveUpdateAt.value = Date.now();

    if (gameData.startTimeUTC) {
      localStartTime.value = DateTime.fromISO(
        gameData.startTimeUTC
      ).toLocaleString(DateTime.DATETIME_FULL);
    }

    const championPlaying = getTeamsInfo(gameData);

    if (!championPlaying) {
      isGameToday.value = false;
      playerChampion.value = resolvePlayerByTeam(currentChampion.value) || {};
      lifecycleHandlers.onChampionNotPlaying?.({
        currentChampionAbbrev: currentChampion.value,
        gameData,
      });
      return;
    }

    isGameToday.value = true;

    if (isGameOver.value) {
      setGameOutcome(gameData);
      if (!wasGameOver) {
        refreshChampionAndGameState({ bustCache: true });
      }
      lifecycleHandlers.onGameOver?.({
        winnerTeamAbbrev: todaysWinner.value.abbrev,
        gameData,
      });
    } else {
      lifecycleHandlers.onGameInProgress?.({ gameData });
    }
  }

  function setGameOutcome(gameData) {
    const homeTeam = gameData.homeTeam;
    const awayTeam = gameData.awayTeam;
    if (!homeTeam || !awayTeam) return;

    const winnerTeam = homeTeam.score > awayTeam.score ? homeTeam : awayTeam;
    const loserTeam = winnerTeam === homeTeam ? awayTeam : homeTeam;

    todaysWinner.value = {
      ...winnerTeam,
      player: resolvePlayerByTeam(winnerTeam.abbrev),
    };
    todaysLoser.value = {
      ...loserTeam,
      player: resolvePlayerByTeam(loserTeam.abbrev),
    };
  }

  onBeforeUnmount(() => {
    Object.values(goalTimers.value).forEach((timer) => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  });

  return {
    loading,
    homeError,
    currentChampion,
    localStartTime,
    todaysGame,
    todaysWinner,
    todaysLoser,
    playerChampion,
    playerChallenger,
    secondsRemaining,
    isGameToday,
    isGameOver,
    isGameLive,
    isSeasonOver,
    isMirrorMatch,
    gameID,
    cupGameId,
    selectedGameId,
    lastLiveUpdateAt,
    clockTime,
    period,
    championAvatarType,
    challengerAvatarType,
    gameOverWinnerAvatarType,
    gameOverLoserAvatarType,
    seasonMetaWarning,
    setLifecycleHandlers,
    refreshSeasonMeta,
    refreshChampionAndGameState,
    getGameInfo,
    getQuote,
    applyGameUpdate,
  };
}
