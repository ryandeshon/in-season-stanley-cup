import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.clearAllMocks();
    __socketState.isConnected.value = true;
    __socketState.lastMessage.value = null;
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
