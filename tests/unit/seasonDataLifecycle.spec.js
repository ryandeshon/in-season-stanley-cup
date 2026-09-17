import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountComposable } from './helpers/mountComposable';
import { useSeasonStore } from '@/store/seasonStore';
import { useSeasonData } from '@/composables/useSeasonData';
import { usePlayerSeasonData } from '@/composables/usePlayerSeasonData';
import {
  getAllPlayers,
  getGameRecords,
  getPlayerData,
} from '@/services/dynamodbService';
vi.mock('@/services/dynamodbService', () => ({
  getAllPlayers: vi.fn(),
  getGameRecords: vi.fn(),
  getPlayerData: vi.fn(),
}));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
let mounted;
beforeEach(() => {
  setActivePinia(createPinia());
  const storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  });
  getAllPlayers.mockResolvedValue([]);
  getGameRecords.mockResolvedValue([]);
  getPlayerData.mockResolvedValue(null);
});
afterEach(async () => {
  if (mounted) await mounted.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});
describe('season data lifecycle', () => {
  it('ignores old-season responses and keeps metadata reactive', async () => {
    const old = deferred();
    getAllPlayers
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue([{ name: 'Archived' }]);
    mounted = await mountComposable(useSeasonData);
    useSeasonStore().setSeason('season1');
    await nextTick();
    await flushPromises();
    old.resolve([{ name: 'Current' }]);
    await flushPromises();
    expect(mounted.result.players.value).toEqual([{ name: 'Archived' }]);
    expect(mounted.result.currentSeason.value).toBe('season1');
  });
  it('does not let a stale rejection clear loading or overwrite the current error', async () => {
    const old = deferred(),
      current = deferred();
    getAllPlayers
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    mounted = await mountComposable(useSeasonData);
    useSeasonStore().setSeason('season1');
    await nextTick();
    old.reject(new Error('old request'));
    await flushPromises();
    expect(mounted.result.loading.value).toBe(true);
    expect(mounted.result.error.value).toBeNull();
    current.resolve([]);
    await flushPromises();
    expect(mounted.result.loading.value).toBe(false);
  });
  it('clears prior-season data immediately instead of showing it under the new label', async () => {
    getAllPlayers
      .mockResolvedValueOnce([{ name: 'Current' }])
      .mockReturnValueOnce(deferred().promise);
    mounted = await mountComposable(useSeasonData);
    await flushPromises();
    useSeasonStore().setSeason('season1');
    await nextTick();
    expect(mounted.result.players.value).toEqual([]);
  });
  it('ignores an old profile response after navigation', async () => {
    const old = deferred();
    getPlayerData
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ name: 'Cooper' });
    const name = ref('Ryan');
    mounted = await mountComposable(() => usePlayerSeasonData(name));
    name.value = 'Cooper';
    await nextTick();
    await flushPromises();
    old.resolve({ name: 'Ryan' });
    await flushPromises();
    expect(mounted.result.player.value.name).toBe('Cooper');
  });
  it('does not publish responses after unmount', async () => {
    const old = deferred();
    getAllPlayers.mockReturnValueOnce(old.promise);
    mounted = await mountComposable(useSeasonData);
    const result = mounted.result;
    await mounted.unmount();
    mounted = null;
    old.resolve([{ name: 'Late' }]);
    await flushPromises();
    expect(result.players.value).toEqual([]);
  });
  it('recovers from failure on an explicit refresh', async () => {
    getAllPlayers
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ name: 'Ryan' }]);
    mounted = await mountComposable(useSeasonData);
    await flushPromises();
    expect(mounted.result.error.value.message).toBe('offline');
    await mounted.result.fetchSeasonData();
    expect(mounted.result.players.value).toEqual([{ name: 'Ryan' }]);
    expect(mounted.result.error.value).toBeNull();
  });
});
