import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  initSocket,
  closeSocket,
  clearSocketHandlers,
  useSocket,
} from '@/services/socketClient';

export function useDraftRealtime({ onDraftUpdate } = {}) {
  const { isConnected, lastMessage } = useSocket();
  const isDisconnected = ref(false);

  const stopConnectedWatch = watch(
    isConnected,
    (connected) => {
      isDisconnected.value = !connected;
    },
    { immediate: true }
  );

  const stopMessageWatch = watch(lastMessage, (data) => {
    if (data?.type === 'draftUpdate') {
      onDraftUpdate?.(data.payload, data);
    }
  });

  onMounted(() => {
    initSocket();
  });

  onBeforeUnmount(() => {
    stopConnectedWatch();
    stopMessageWatch();
    closeSocket();
    clearSocketHandlers();
  });

  return {
    isDisconnected,
  };
}
