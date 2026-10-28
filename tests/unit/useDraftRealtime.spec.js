import { nextTick, ref } from 'vue';
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

  it('polls only disconnected drafts every 30 seconds and catches up on reconnect', async () => {
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

  it('repairs a missed browser-originated broadcast after two minutes when connected', async () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn().mockResolvedValue();
    const mounted = await mountComposable(() =>
      useDraftRealtime({ onRefresh })
    );
    await vi.advanceTimersByTimeAsync(119000);
    expect(onRefresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await mounted.unmount();
  });

  it('makes no polling requests during an hour of a completed draft, and resumes after undo', async () => {
    vi.useFakeTimers();
    __socketState.isConnected.value = false;
    const complete = ref(true);
    const onRefresh = vi.fn().mockResolvedValue();
    const mounted = await mountComposable(() =>
      useDraftRealtime({ onRefresh, complete })
    );
    await vi.advanceTimersByTimeAsync(3600000);
    expect(onRefresh).not.toHaveBeenCalled();
    complete.value = false;
    await vi.advanceTimersByTimeAsync(30000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await mounted.unmount();
  });
  it('pauses hidden drafts, catches up on return, and does not poll non-draft seasons', async () => {
    vi.useFakeTimers();
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    __socketState.isConnected.value = false;
    const enabled = ref(true);
    const onRefresh = vi.fn().mockResolvedValue();
    const mounted = await mountComposable(() =>
      useDraftRealtime({ onRefresh, enabled })
    );
    await vi.advanceTimersByTimeAsync(3600000);
    expect(onRefresh).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await nextTick();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    enabled.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(3600000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await mounted.unmount();
    visibility.mockRestore();
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
