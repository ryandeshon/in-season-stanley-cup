import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('@/utilities/previewConfig', () => ({
  hostedPreview: true,
  testDraftEnabled: true,
}));
import { apiRequest } from '@/services/apiClient';
let fetch;
beforeEach(() => {
  const values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal('navigator', {
    locks: { request: (_key, callback) => callback() },
  });
  vi.stubEnv('VUE_APP_API_BASE', 'https://production.example');
  fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('reads and writes only local storage even with a production API configured', async () => {
  const state = await apiRequest('/draft/state');
  const started = await apiRequest('/draft/state', {
    method: 'PATCH',
    body: { version: state.version, draftStarted: true },
  });
  expect(started.draftStarted).toBe(true);
  expect((await apiRequest('/draft/state')).version).toBe(1);
  expect(fetch).not.toHaveBeenCalled();
});
it('fails closed for unsupported routes and unavailable storage', async () => {
  await expect(
    apiRequest('/unknown', { method: 'POST' })
  ).rejects.toMatchObject({ status: 405 });
  vi.stubGlobal('localStorage', {
    getItem() {
      throw Error('Storage blocked');
    },
  });
  await expect(apiRequest('/draft/state')).rejects.toThrow('Storage blocked');
  expect(fetch).not.toHaveBeenCalled();
});
it('fails closed when cross-tab write locking is unavailable', async () => {
  vi.stubGlobal('navigator', {});
  await expect(
    apiRequest('/draft/state', {
      method: 'PATCH',
      body: { version: 0, draftStarted: true },
    })
  ).rejects.toThrow('Web Locks');
  expect(fetch).not.toHaveBeenCalled();
});
