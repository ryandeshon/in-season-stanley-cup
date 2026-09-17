import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  initSocket,
  closeSocket,
  clearSocketHandlers,
  useSocket,
} from '@/services/socketClient';

export function useDraftRealtime({
  onDraftUpdate,
  onRefresh,
  pollMs = 30000,
} = {}) {
  const { isConnected, lastMessage } = useSocket();
  const isDisconnected = ref(false);
  let pollTimer;
  let mounted = false;
  let refreshing = false;
  async function refresh() {
    if (!mounted || refreshing || !onRefresh) return;
    refreshing = true;
    try {
      await onRefresh();
    } catch (error) {
      console.warn('Draft refresh failed; retrying on the next poll', error);
    } finally {
      refreshing = false;
    }
  }

  const stopConnectedWatch = watch(
    isConnected,
    (connected, previous) => {
      isDisconnected.value = !connected;
      if (connected && previous === false) refresh();
    },
    { immediate: true }
  );

  const stopMessageWatch = watch(lastMessage, (data) => {
    if (data?.type === 'draftUpdate') {
      onDraftUpdate?.(data.payload, data);
    }
  });

  onMounted(() => {
    mounted = true;
    initSocket();
    if (onRefresh) {
      pollTimer = setInterval(() => {
        if (!isConnected.value) refresh();
      }, pollMs);
    }
  });

  onBeforeUnmount(() => {
    mounted = false;
    clearInterval(pollTimer);
    stopConnectedWatch();
    stopMessageWatch();
    closeSocket();
    clearSocketHandlers();
  });

  return {
    isDisconnected,
  };
}
