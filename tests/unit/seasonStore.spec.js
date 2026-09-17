import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSeasonStore } from '@/store/seasonStore';
import { apiRequest } from '@/services/apiClient';
vi.mock('@/services/apiClient', () => ({ apiRequest: vi.fn() }));
const catalog = {
  storageVersion: 'v2',
  defaultSeason: 'season3',
  seasons: [
    { id: 'season1', status: 'archived' },
    { id: 'season2', status: 'archived' },
    { id: 'season3', status: 'preseason', writersEnabled: true },
  ],
};
beforeEach(() => {
  setActivePinia(createPinia());
  const values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  });
  vi.resetAllMocks();
});
describe('season catalog', () => {
  it('uses the catalog default and enables only the new draft', async () => {
    apiRequest.mockResolvedValue(catalog);
    const store = useSeasonStore();
    await store.loadCatalog();
    expect(store.currentSeason).toBe('season3');
    expect(store.canDraft).toBe(true);
    store.setSeason('season1');
    expect(store.canDraft).toBe(false);
    store.setSeason('season99');
    expect(store.currentSeason).toBe('season1');
  });
  it('preserves a valid explicit selection and discards an obsolete one', async () => {
    apiRequest.mockResolvedValue(catalog);
    localStorage.setItem('selectedSeason', 'season2');
    const store = useSeasonStore();
    await store.loadCatalog();
    expect(store.currentSeason).toBe('season2');
    localStorage.setItem('selectedSeason', 'season99');
    await store.loadCatalog();
    expect(store.currentSeason).toBe('season3');
  });
  it('falls back only when the legacy API has no catalog', async () => {
    const store = useSeasonStore();
    apiRequest.mockRejectedValue({ status: 404 });
    await store.loadCatalog();
    expect(store.catalogError).toBeNull();
    apiRequest.mockRejectedValue({ status: 503 });
    await store.loadCatalog();
    expect(store.catalogError).toContain('unavailable');
  });
});
