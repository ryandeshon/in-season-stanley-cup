import { ref } from 'vue';

const socket = ref(null);
const isConnected = ref(false);
const lastMessage = ref(null);
let messageHandlers = [];
let reconnectTimeout = null;
let reconnectAttempts = 0; // Track the number of reconnection attempts
const maxReconnectAttempts = 10; // Set the maximum number of attempts

export function initSocket({ onMessage, onOpen, onClose, onError } = {}) {
  if (!process.env.VUE_APP_WEB_SOCKET_URL) {
    console.warn('WebSocket URL not configured; skipping socket init');
    isConnected.value = false; // Explicitly set disconnected state
    return null;
  }

  if (socket.value && socket.value.readyState === WebSocket.OPEN)
    return socket.value;

  socket.value = new WebSocket(process.env.VUE_APP_WEB_SOCKET_URL);

  socket.value.onopen = () => {
    isConnected.value = true;
    reconnectAttempts = 0; // Reset attempts on successful connection
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
    scheduleReconnect(); // Schedule reconnection
  };

  socket.value.onerror = (error) => {
    onError?.(error);
    console.error('⚠️ WebSocket error:', error);
  };

  return socket.value;
}

function scheduleReconnect() {
  if (reconnectTimeout || reconnectAttempts >= maxReconnectAttempts) return; // Stop if max attempts reached
  reconnectTimeout = setTimeout(() => {
    reconnectAttempts++;
    console.log(
      `🔄 Attempting to reconnect WebSocket... (${reconnectAttempts}/${maxReconnectAttempts})`
    );
    initSocket();
    reconnectTimeout = null;
  }, 5000); // Retry every 5 seconds
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

export function resetReconnectAttempts() {
  reconnectAttempts = 0; // Reset the counter when needed
}

export function useSocket() {
  return {
    socket,
    isConnected,
    lastMessage,
  };
}
