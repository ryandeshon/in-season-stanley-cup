import { ref, watch, onBeforeUnmount } from 'vue';
import { initSocket, closeSocket, useSocket } from '@/services/socketClient';

const POLL_INTERVAL_MS = 30000;
const CHAMPION_REFRESH_MS = 5 * 60 * 1000;
const IDLE_REFRESH_MS = 15 * 60 * 1000;
const SOCKET_STALE_MS = 90 * 1000;

/**
 * Home page realtime/polling orchestration.
 *
 * Inputs:
 * - Refs: `cupGameId`, `selectedGameId`, `isGameToday`, `isGameOver`,
 *   `lastLiveUpdateAt`
 * - Methods: `getGameInfo`, `applyGameUpdate`, `refreshChampionAndGameState`
 *
 * Outputs:
 * - `initLiveFeed`, polling/champion-refresh controls, and `isDisconnected`
 */
export function useLiveGameFeed({
  cupGameId,
  selectedGameId,
  isGameToday,
  isGameOver,
  gameStartTime,
  homeError,
  lastLiveUpdateAt,
  getGameInfo,
  applyGameUpdate,
  refreshChampionAndGameState,
} = {}) {
  const { lastMessage, isConnected } = useSocket();
  const isDisconnected = ref(false);
  let pollIntervalId = null;
  let championRefreshIntervalId = null;
  let visibilityHandlerBound = null;
  let lastChampionRefreshAt = Date.now();
  let refreshingChampion = false;
  let pollingGame = false;
  let socketStarted = false;
  const visible = () => document.visibilityState !== 'hidden';
  async function refreshChampion() {
    if (!visible() || refreshingChampion) return;
    refreshingChampion = true;
    lastChampionRefreshAt = Date.now();
    try {
      await refreshChampionAndGameState?.({ bustCache: true });
    } finally {
      refreshingChampion = false;
    }
  }
  async function refreshGame() {
    if (!visible() || pollingGame) return;
    pollingGame = true;
    try {
      await getGameInfo?.();
    } finally {
      pollingGame = false;
    }
  }

  const stopConnectedWatch = watch(
    isConnected,
    (newVal) => {
      isDisconnected.value = !newVal;
    },
    { immediate: true }
  );

  const stopMessageWatch = watch(lastMessage, (data) => {
    const incomingGameId = data?.payload?.id;
    if (
      visible() &&
      data?.type === 'liveGameUpdate' &&
      (!incomingGameId ||
        String(incomingGameId) ===
          String(selectedGameId?.value || cupGameId?.value))
    ) {
      applyGameUpdate?.(data.payload);
    }
  });

  function initLiveFeed() {
    socketStarted = true;
    if (visible()) initSocket();
  }

  function shouldPollGame() {
    return (
      Boolean(selectedGameId?.value) && isGameToday?.value && !isGameOver?.value
    );
  }

  function startPolling() {
    if (pollIntervalId || !shouldPollGame()) return;

    pollIntervalId = setInterval(() => {
      if (!shouldPollGame()) {
        stopPolling();
        return;
      }

      if (!visible()) return;
      const now = Date.now();
      const start = Date.parse(gameStartTime?.value);
      // Scheduled games cannot produce live stats before faceoff.
      if (Number.isFinite(start) && start > now) return;
      const isStale = now - (lastLiveUpdateAt?.value || 0) > SOCKET_STALE_MS;

      if (isDisconnected.value || isStale) {
        refreshGame();
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  function startChampionRefresh() {
    if (championRefreshIntervalId) return;
    championRefreshIntervalId = setInterval(() => {
      const interval = shouldPollGame() ? CHAMPION_REFRESH_MS : IDLE_REFRESH_MS;
      if (Date.now() - lastChampionRefreshAt >= interval) refreshChampion();
    }, CHAMPION_REFRESH_MS);
  }

  function stopChampionRefresh() {
    if (championRefreshIntervalId) {
      clearInterval(championRefreshIntervalId);
      championRefreshIntervalId = null;
    }
  }

  function setupVisibilityRefresh() {
    if (visibilityHandlerBound || typeof document === 'undefined') return;
    visibilityHandlerBound = () => {
      if (!visible()) {
        if (socketStarted) closeSocket();
        return;
      }
      if (socketStarted) initSocket();
      if (
        isGameOver?.value ||
        homeError?.value ||
        Date.now() - lastChampionRefreshAt >= 60000
      )
        refreshChampion();
      if (
        shouldPollGame() &&
        Date.now() - (lastLiveUpdateAt?.value || 0) >= POLL_INTERVAL_MS
      )
        refreshGame();
    };
    document.addEventListener('visibilitychange', visibilityHandlerBound);
  }

  function clearVisibilityRefresh() {
    if (!visibilityHandlerBound || typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', visibilityHandlerBound);
    visibilityHandlerBound = null;
  }

  onBeforeUnmount(() => {
    stopConnectedWatch();
    stopMessageWatch();
    stopPolling();
    stopChampionRefresh();
    clearVisibilityRefresh();
    if (socketStarted) closeSocket();
  });

  return {
    isDisconnected,
    initLiveFeed,
    startPolling,
    stopPolling,
    startChampionRefresh,
    stopChampionRefresh,
    setupVisibilityRefresh,
    clearVisibilityRefresh,
  };
}
