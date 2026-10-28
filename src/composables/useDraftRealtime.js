import { ref, watch, toValue, onMounted, onBeforeUnmount } from 'vue';
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
  enabled = true,
  complete = false,
} = {}) {
  const { isConnected, lastMessage } = useSocket();
  const isDisconnected = ref(false);
  let pollTimer;
  let mounted = false;
  let refreshing = false;
  let lastSyncAt = Date.now();
  const visible = () => document.visibilityState !== 'hidden';
  const active = () => mounted && visible() && toValue(enabled);
  async function refresh() {
    if (!active() || refreshing || !onRefresh) return;
    refreshing = true;
    lastSyncAt = Date.now();
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
    if (active() && data?.type === 'draftUpdate') {
      lastSyncAt = Date.now();
      onDraftUpdate?.(data.payload, data);
    }
  });

  function visibility() {
    if (!visible()) closeSocket();
    else if (active()) {
      initSocket();
      refresh();
    }
  }
  const stopEnabledWatch = watch(
    () => toValue(enabled),
    () => {
      if (!mounted) return;
      if (active()) {
        initSocket();
        refresh();
      } else closeSocket();
    }
  );

  onMounted(() => {
    mounted = true;
    if (active()) initSocket();
    document.addEventListener('visibilitychange', visibility);
    if (onRefresh) {
      pollTimer = setInterval(() => {
        // Picks broadcast from the sending browser after the HTTP write.
        // A connected socket alone cannot prove that a broadcast was delivered.
        if (
          active() &&
          !toValue(complete) &&
          (!isConnected.value || Date.now() - lastSyncAt >= 120000)
        )
          refresh();
      }, pollMs);
    }
  });

  onBeforeUnmount(() => {
    mounted = false;
    clearInterval(pollTimer);
    document.removeEventListener('visibilitychange', visibility);
    stopEnabledWatch();
    stopConnectedWatch();
    stopMessageWatch();
    closeSocket();
    clearSocketHandlers();
  });

  return {
    isDisconnected,
  };
}
