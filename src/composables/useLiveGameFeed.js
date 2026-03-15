import { ref, watch, onBeforeUnmount } from 'vue';
import { initSocket, useSocket } from '@/services/socketClient';

const POLL_INTERVAL_MS = 30000;
const CHAMPION_REFRESH_MS = 5 * 60 * 1000;

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
      data?.type === 'liveGameUpdate' &&
      (!incomingGameId ||
        String(incomingGameId) ===
          String(selectedGameId?.value || cupGameId?.value))
    ) {
      applyGameUpdate?.(data.payload);
    }
  });

  function initLiveFeed() {
    initSocket();
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

      const now = Date.now();
      const isStale = now - (lastLiveUpdateAt?.value || 0) > POLL_INTERVAL_MS;

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

  function startChampionRefresh() {
    if (championRefreshIntervalId) return;
    championRefreshIntervalId = setInterval(() => {
      refreshChampionAndGameState?.({ bustCache: true });
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
      if (document.visibilityState === 'visible') {
        refreshChampionAndGameState?.({ bustCache: true });
      }
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
