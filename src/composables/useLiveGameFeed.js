import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { DateTime } from 'luxon';
import { initSocket, useSocket } from '@/services/socketClient';

const POLL_INTERVAL_MS = 30000;

/**
 * useLiveGameFeed
 * Responsibility: manage live update ingestion (socket + polling) and
 * scoreboard-reactive avatar state for the active cup game.
 *
 * Inputs:
 * - `todaysGame`, `currentChampion`, `isGameToday`, `isGameOver`, `isGameLive`,
 *   `selectedGameId`, `cupGameId` (Refs): live state needed for filtering and UI.
 * - `getGameInfo` (Function): fallback poll fetcher for stale/disconnected state.
 * - `onGameUpdate` (Function): called for each relevant socket game payload.
 *
 * Outputs:
 * - `clockTime`, `period`, `isDisconnected`, avatar computed state.
 * - Actions: `recordGameUpdate`, `startLiveFeed`, `startPolling`, `stopPolling`.
 */
export function useLiveGameFeed({
  todaysGame,
  currentChampion,
  isGameToday,
  isGameOver,
  isGameLive,
  selectedGameId,
  cupGameId,
  getGameInfo,
  onGameUpdate,
}) {
  const secondsRemaining = ref(null);
  const isDisconnected = ref(false);
  const lastLiveUpdateAt = ref(0);
  const recentGoalAgainst = ref({ home: false, away: false });
  const goalTimers = ref({ home: null, away: null });
  let pollIntervalId = null;

  const { lastMessage, isConnected } = useSocket();

  const clockTime = computed(() => {
    if (
      secondsRemaining.value === null ||
      secondsRemaining.value === undefined
    ) {
      return '--:--';
    }
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

  function recordGameUpdate(gameData) {
    secondsRemaining.value = gameData?.clock?.secondsRemaining ?? 0;
    lastLiveUpdateAt.value = Date.now();
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

  function shouldPollGame() {
    return (
      Boolean(selectedGameId.value) && isGameToday.value && !isGameOver.value
    );
  }

  function startPolling() {
    if (pollIntervalId || !shouldPollGame()) return;

    pollIntervalId = setInterval(() => {
      if (!shouldPollGame()) {
        stopPolling();
        return;
      }

      const now = Date.now();
      const isStale = now - lastLiveUpdateAt.value > POLL_INTERVAL_MS;
      if (isDisconnected.value || isStale) {
        getGameInfo?.();
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  function startLiveFeed() {
    initSocket();
    startPolling();
  }

  watch(
    isConnected,
    (connected) => {
      isDisconnected.value = !connected;
    },
    { immediate: true }
  );

  watch(
    () => todaysGame.value.clock?.secondsRemaining,
    (newVal) => {
      if (newVal !== undefined) {
        secondsRemaining.value = newVal;
      }
    }
  );

  watch(lastMessage, (data) => {
    const incomingGameId = data?.payload?.id;
    if (
      data?.type === 'liveGameUpdate' &&
      (!incomingGameId ||
        String(incomingGameId) ===
          String(selectedGameId.value || cupGameId.value))
    ) {
      onGameUpdate?.(data.payload);
    }
  });

  watch(
    () => todaysGame.value.homeTeam?.score,
    (newScore, oldScore) => {
      if (oldScore !== undefined && newScore > oldScore) {
        triggerAnguishAvatar('away');
      }
    }
  );

  watch(
    () => todaysGame.value.awayTeam?.score,
    (newScore, oldScore) => {
      if (oldScore !== undefined && newScore > oldScore) {
        triggerAnguishAvatar('home');
      }
    }
  );

  onBeforeUnmount(() => {
    stopPolling();
    Object.values(goalTimers.value).forEach((timer) => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  });

  return {
    clockTime,
    period,
    isDisconnected,
    championAvatarType,
    challengerAvatarType,
    gameOverWinnerAvatarType,
    gameOverLoserAvatarType,
    recordGameUpdate,
    startLiveFeed,
    startPolling,
    stopPolling,
  };
}
