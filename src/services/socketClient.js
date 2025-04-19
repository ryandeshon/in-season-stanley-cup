import { ref } from 'vue';

const socket = ref(null);
const isConnected = ref(false);
const lastMessage = ref(null);
let messageHandlers = [];

export function initSocket({ onMessage, onOpen, onClose, onError } = {}) {
  if (socket.value && socket.value.readyState === WebSocket.OPEN)
    return socket.value;

  socket.value = new WebSocket(process.env.VUE_APP_WEB_SOCKET_URL);

  socket.value.onopen = () => {
    isConnected.value = true;
    onOpen?.();
    console.log('✅ WebSocket connected');
  };
  socket.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      lastMessage.value = data;
      onMessage?.(data);
      messageHandlers.forEach((fn) => fn(data));
    } catch (err) {
      console.error('💥 Failed to parse message:', event.data);
    }
  };

  socket.value.onclose = () => {
    isConnected.value = false;
    onClose?.();
    console.log('❌ WebSocket closed');
  };

  socket.value.onerror = (error) => {
    onError?.(error);
    console.error('⚠️ WebSocket error:', error);
  };

  return socket.value;
}

export function sendSocketMessage(action, payload) {
  if (socket.value && socket.value.readyState === WebSocket.OPEN) {
    socket.value.send(JSON.stringify({ action, payload }));
  } else {
    console.warn('WebSocket not ready – cannot send');
  }
}

export function closeSocket() {
  if (socket.value) {
    socket.value.close();
    socket.value = null;
    isConnected.value = false;
  }
}

export function onSocketMessage(handler) {
  if (typeof handler === 'function') {
    messageHandlers.push(handler);
  }
}

export function clearSocketHandlers() {
  messageHandlers = [];
}

export function useSocket() {
  return {
    socket,
    isConnected,
    lastMessage,
  };
}
