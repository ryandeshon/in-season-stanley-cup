import { ref } from 'vue';

const socket = ref(null);
const isConnected = ref(false);
const lastMessage = ref(null);
let messageHandlers = [];
let reconnectTimeout = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

export function initSocket({
  onMessage,
  onOpen,
  onClose,
  onError,
  devMode = true,
} = {}) {
  if (socket.value && socket.value.readyState === WebSocket.OPEN)
    return socket.value;

  const wsUrl = resolveWsUrl();
  if (!wsUrl) {
    console.error(
      '❌ WebSocket URL missing. Set one of: VITE_APP_WEB_SOCKET_URL / VITE_WEB_SOCKET_URL / VUE_APP_WEB_SOCKET_URL'
    );
    return;
  }

  console.log('🔌 Opening WebSocket to:', wsUrl);
  socket.value = new WebSocket(wsUrl);

  socket.value.onopen = () => {
    isConnected.value = true;
    reconnectAttempts = 0;
    console.log('✅ WebSocket connected');

    // 🧪 Automatically subscribe when connected
    socket.value.send(
      JSON.stringify({
        action: 'subscribeGame',
        dev: devMode,
      })
    );

    onOpen?.();
  };

  socket.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      lastMessage.value = data;
      onMessage?.(data);
      messageHandlers.forEach((fn) => fn(data));

      // Log message for debugging
      console.log('📡 WebSocket message received:', data);
    } catch (err) {
      console.error('💥 Failed to parse message:', event.data);
    }
  };

  socket.value.onclose = () => {
    isConnected.value = false;
    console.log('❌ WebSocket closed');
    onClose?.();
    scheduleReconnect();
  };

  socket.value.onerror = (error) => {
    console.error('⚠️ WebSocket error:', error);
    onError?.(error);
  };

  return socket.value;
}

function scheduleReconnect() {
  if (reconnectTimeout || reconnectAttempts >= maxReconnectAttempts) return;
  reconnectTimeout = setTimeout(() => {
    reconnectAttempts++;
    console.log(
      `🔄 Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`
    );
    initSocket();
    reconnectTimeout = null;
  }, 5000);
}

function resolveWsUrl() {
  let viteUrl = null;

  // Guard for Vite-style env (import.meta.env)
  try {
    viteUrl =
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.VITE_APP_WEB_SOCKET_URL ||
        import.meta.env.VITE_WEB_SOCKET_URL ||
        import.meta.env.VITE_WEBSOCKET_URL);
  } catch {
    viteUrl = null; // ignore if not available
  }

  // Vue CLI / Webpack-style env
  const webpackUrl =
    process.env.VITE_APP_WEB_SOCKET_URL ||
    process.env.VUE_APP_WEB_SOCKET_URL ||
    process.env.WEB_SOCKET_URL ||
    null;

  return viteUrl || webpackUrl;
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

export function useSocket() {
  return { socket, isConnected, lastMessage };
}
