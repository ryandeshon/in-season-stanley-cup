import { afterEach, expect, it, vi } from 'vitest';
import { apiRequest } from '@/services/apiClient';
afterEach(() => vi.unstubAllGlobals());
it('revalidates forced reads without creating timestamp cache keys or losing season scope', async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ champion: 'DAL' }),
  });
  vi.stubGlobal('fetch', fetch);
  await apiRequest('/champion', {
    baseURL: 'https://example.com',
    query: { season: 'season3' },
    bustCache: true,
  });
  expect(fetch).toHaveBeenCalledWith(
    'https://example.com/champion?season=season3',
    expect.objectContaining({ cache: 'no-cache', method: 'GET' })
  );
});
