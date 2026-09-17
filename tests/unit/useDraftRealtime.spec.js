import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/socketClient', async () => {
  const { ref } = await import('vue');
  const socketState = {
    isConnected: ref(true),
    lastMessage: ref(null),
    initSocket: vi.fn(),
    closeSocket: vi.fn(),
    clearSocketHandlers: vi.fn(),
  };

  return {
    initSocket: socketState.initSocket,
    closeSocket: socketState.closeSocket,
    clearSocketHandlers: socketState.clearSocketHandlers,
    useSocket: () => ({
      isConnected: socketState.isConnected,
      lastMessage: socketState.lastMessage,
    }),
    __socketState: socketState,
  };
});

import { __socketState } from '@/services/socketClient';
import { useDraftRealtime } from '@/composables/useDraftRealtime';
import { mountComposable } from './helpers/mountComposable';

describe('useDraftRealtime', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks();
    __socketState.isConnected.value = true;
    __socketState.lastMessage.value = null;
  });

  it('polls while disconnected, refreshes on reconnect and stops on unmount', async () => {
    vi.useFakeTimers();
    __socketState.isConnected.value = false;
    const onRefresh = vi.fn().mockResolvedValue();
    const mounted = await mountComposable(() =>
      useDraftRealtime({ onRefresh })
    );
    await vi.advanceTimersByTimeAsync(30000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    __socketState.isConnected.value = true;
    await nextTick();
    expect(onRefresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30000);
    expect(onRefresh).toHaveBeenCalledTimes(2);
    await mounted.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('initializes socket on mount and tracks disconnect state', async () => {
    __socketState.isConnected.value = false;
    const onDraftUpdate = vi.fn();

    const mounted = await mountComposable(() =>
      useDraftRealtime({ onDraftUpdate })
    );

    expect(__socketState.initSocket).toHaveBeenCalledTimes(1);
    expect(mounted.result.isDisconnected.value).toBe(true);

    await mounted.unmount();
  });

  it('forwards draftUpdate events and cleans up on unmount', async () => {
    const onDraftUpdate = vi.fn();
    const mounted = await mountComposable(() =>
      useDraftRealtime({ onDraftUpdate })
    );

    __socketState.lastMessage.value = {
      type: 'draftUpdate',
      payload: { pickNumber: 8, player: 'Ryan' },
    };
    await nextTick();

    expect(onDraftUpdate).toHaveBeenCalledTimes(1);
    expect(onDraftUpdate).toHaveBeenCalledWith(
      { pickNumber: 8, player: 'Ryan' },
      expect.objectContaining({ type: 'draftUpdate' })
    );

    await mounted.unmount();

    expect(__socketState.closeSocket).toHaveBeenCalledTimes(1);
    expect(__socketState.clearSocketHandlers).toHaveBeenCalledTimes(1);
  });
});
