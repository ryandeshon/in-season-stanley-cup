import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const preview = vi.hoisted(() => ({
  hostedPreview: false,
  testDraftEnabled: false,
  testDraftSocketUrl: '',
}));
vi.mock('@/utilities/previewConfig', () => preview);
import { initSocket, closeSocket, useSocket } from '@/services/socketClient';
let instances;
beforeEach(() => {
  vi.useFakeTimers();
  instances = [];
  Object.assign(preview, {
    hostedPreview: false,
    testDraftEnabled: false,
    testDraftSocketUrl: '',
  });
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
      constructor(url) {
        this.url = url;
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

it('keeps fixture previews disconnected and uses only the dedicated Test socket in draft mode', () => {
  preview.hostedPreview = true;
  expect(initSocket()).toBeNull();
  preview.testDraftEnabled = true;
  expect(initSocket()).toBeNull();
  preview.testDraftSocketUrl = 'wss://dedicated-test.example/test';
  initSocket();
  expect(instances).toHaveLength(1);
  expect(instances[0].url).toBe(preview.testDraftSocketUrl);
});
