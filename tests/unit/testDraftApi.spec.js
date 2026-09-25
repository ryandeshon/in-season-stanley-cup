import { afterEach, expect, it, vi } from 'vitest';
const preview = vi.hoisted(() => ({
  hostedPreview: true,
  previewBase: 'https://test.example/__arcade-preview',
  testDraftEnabled: true,
  testDraftApiBase: '',
}));
vi.mock('@/utilities/previewConfig', () => preview);
import { apiRequest } from '@/services/apiClient';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('fails closed when the dedicated Test API is missing instead of using the inherited production API', async () => {
  vi.stubEnv('VUE_APP_API_BASE', 'https://production.example');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  preview.testDraftApiBase = '';
  await expect(apiRequest('/draft/state')).rejects.toThrow('not configured');
  expect(fetch).not.toHaveBeenCalled();
});
it('routes draft mode requests only to the dedicated Test API', async () => {
  preview.testDraftApiBase = 'https://dedicated-test.example/test';
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response('{}', { headers: { 'content-type': 'application/json' } })
    );
  vi.stubGlobal('fetch', fetch);
  await apiRequest('/draft/state', { query: { season: 'season3' } });
  expect(fetch.mock.calls[0][0]).toBe(
    'https://dedicated-test.example/test/draft/state?season=season3'
  );
});
