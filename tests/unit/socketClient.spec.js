import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { initSocket, closeSocket, useSocket } from '@/services/socketClient';
let instances;
beforeEach(() => {
  vi.useFakeTimers();
  instances = [];
  vi.stubEnv('VUE_APP_WEB_SOCKET_URL', 'ws://localhost/test');
  vi.stubGlobal(
    'WebSocket',
    class {
      static OPEN = 1;
      static CONNECTING = 0;
      readyState = 0;
      close() {
        this.onclose?.();
      }
      constructor() {
        instances.push(this);
      }
    }
  );
});
afterEach(() => {
  closeSocket();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('reuses a connecting socket and never reconnects after intentional close', async () => {
  initSocket();
  initSocket();
  expect(instances).toHaveLength(1);
  closeSocket();
  await vi.advanceTimersByTimeAsync(10000);
  expect(instances).toHaveLength(1);
  expect(useSocket().isConnected.value).toBe(false);
});
it('cancels a pending reconnect when the page unmounts', async () => {
  initSocket();
  instances[0].readyState = 3;
  instances[0].onclose();
  expect(vi.getTimerCount()).toBe(1);
  closeSocket();
  await vi.advanceTimersByTimeAsync(10000);
  expect(instances).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});
it('reconnects after an unexpected disconnect', async () => {
  initSocket();
  instances[0].readyState = 3;
  instances[0].onclose();
  await vi.advanceTimersByTimeAsync(5000);
  expect(instances).toHaveLength(2);
});
