import { nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/socketClient', async () => {
  const { ref: vueRef } = await import('vue');
  const socketState = {
    isConnected: vueRef(true),
    lastMessage: vueRef(null),
    initSocket: vi.fn(),
  };

  return {
    initSocket: socketState.initSocket,
    useSocket: () => ({
      isConnected: socketState.isConnected,
      lastMessage: socketState.lastMessage,
    }),
    __socketState: socketState,
  };
});

import { __socketState } from '@/services/socketClient';
import { useLiveGameFeed } from '@/composables/useLiveGameFeed';

describe('useLiveGameFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __socketState.isConnected.value = true;
    __socketState.lastMessage.value = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createComposable(overrides = {}) {
    const cupGameId = ref('2024021111');
    const selectedGameId = ref('2024021111');
    const isGameToday = ref(true);
    const isGameOver = ref(false);
    const lastLiveUpdateAt = ref(0);
    const getGameInfo = vi.fn();
    const applyGameUpdate = vi.fn();
    const refreshChampionAndGameState = vi.fn();

    const composable = useLiveGameFeed({
      cupGameId,
      selectedGameId,
      isGameToday,
      isGameOver,
      lastLiveUpdateAt,
      getGameInfo,
      applyGameUpdate,
      refreshChampionAndGameState,
      ...overrides,
    });

    return {
      composable,
      deps: {
        cupGameId,
        selectedGameId,
        isGameToday,
        isGameOver,
        lastLiveUpdateAt,
        getGameInfo,
        applyGameUpdate,
        refreshChampionAndGameState,
      },
    };
  }

  it('initializes the websocket client', () => {
    const { composable } = createComposable();
    composable.initLiveFeed();

    expect(__socketState.initSocket).toHaveBeenCalledTimes(1);
  });

  it('applies matching live game updates from the socket stream', async () => {
    const { deps } = createComposable();

    __socketState.lastMessage.value = {
      type: 'liveGameUpdate',
      payload: { id: '2024021111', gameState: 'LIVE' },
    };
    await nextTick();

    expect(deps.applyGameUpdate).toHaveBeenCalledTimes(1);

    __socketState.lastMessage.value = {
      type: 'liveGameUpdate',
      payload: { id: '9999999999', gameState: 'LIVE' },
    };
    await nextTick();

    expect(deps.applyGameUpdate).toHaveBeenCalledTimes(1);
  });

  it('polls game info when feed is stale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T00:00:00Z'));
    const { composable, deps } = createComposable();

    deps.lastLiveUpdateAt.value = 0;
    composable.startPolling();
    vi.advanceTimersByTime(30000);

    expect(deps.getGameInfo).toHaveBeenCalledTimes(1);
    composable.stopPolling();
  });

  it('polls game info when disconnected even if update is fresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T00:00:00Z'));
    const { composable, deps } = createComposable();

    deps.lastLiveUpdateAt.value = Date.now();
    __socketState.isConnected.value = false;
    await nextTick();

    composable.startPolling();
    vi.advanceTimersByTime(30000);

    expect(composable.isDisconnected.value).toBe(true);
    expect(deps.getGameInfo).toHaveBeenCalledTimes(1);
    composable.stopPolling();
  });

  it('does not poll when game is not active', () => {
    vi.useFakeTimers();
    const { composable, deps } = createComposable();

    deps.isGameToday.value = false;
    composable.startPolling();
    vi.advanceTimersByTime(60000);

    expect(deps.getGameInfo).not.toHaveBeenCalled();
  });

  it('refreshes champion state on tab visibility event', () => {
    const { composable, deps } = createComposable();

    composable.setupVisibilityRefresh();
    document.dispatchEvent(new Event('visibilitychange'));
    composable.clearVisibilityRefresh();
    document.dispatchEvent(new Event('visibilitychange'));

    expect(deps.refreshChampionAndGameState).toHaveBeenCalledTimes(1);
    expect(deps.refreshChampionAndGameState).toHaveBeenCalledWith({
      bustCache: true,
    });
  });

  it('runs champion refresh interval on schedule', () => {
    vi.useFakeTimers();
    const { composable, deps } = createComposable();

    composable.startChampionRefresh();
    vi.advanceTimersByTime(5 * 60 * 1000);
    composable.stopChampionRefresh();

    expect(deps.refreshChampionAndGameState).toHaveBeenCalledTimes(1);
    expect(deps.refreshChampionAndGameState).toHaveBeenCalledWith({
      bustCache: true,
    });
  });
});
