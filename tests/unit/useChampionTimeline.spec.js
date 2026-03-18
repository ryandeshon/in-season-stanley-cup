import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('@/services/championServices', () => ({
  areSeasonContractEndpointsEnabled: vi.fn(),
  getChampionHistory: vi.fn(),
  shouldUseContractFallback: vi.fn(),
}));

import {
  areSeasonContractEndpointsEnabled,
  getChampionHistory,
  shouldUseContractFallback,
} from '@/services/championServices';
import { useChampionTimeline } from '@/composables/useChampionTimeline';
import { mountComposable } from './helpers/mountComposable';

describe('useChampionTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
    areSeasonContractEndpointsEnabled.mockReturnValue(true);
    shouldUseContractFallback.mockReturnValue(false);
  });

  it('loads, sorts newest-first, computes streak, and paginates by page size', async () => {
    const season = ref('season2');

    getChampionHistory.mockResolvedValue({
      history: [
        {
          gameId: 1,
          winnerTeam: 'BOS',
          loserTeam: 'TOR',
          winnerScore: 4,
          loserScore: 2,
          recordedAt: '2026-03-10T01:00:00.000Z',
        },
        {
          gameId: 4,
          winnerTeam: 'VAN',
          loserTeam: 'SEA',
          winnerScore: 3,
          loserScore: 1,
          recordedAt: '2026-03-13T01:00:00.000Z',
        },
        {
          gameId: 3,
          winnerTeam: 'VAN',
          loserTeam: 'PHI',
          winnerScore: 2,
          loserScore: 1,
          recordedAt: '2026-03-12T01:00:00.000Z',
        },
        {
          gameId: 2,
          winnerTeam: 'VAN',
          loserTeam: 'NYR',
          winnerScore: 5,
          loserScore: 4,
          recordedAt: '2026-03-11T01:00:00.000Z',
        },
        {
          gameId: 5,
          winnerTeam: 'DAL',
          loserTeam: 'COL',
          winnerScore: 2,
          loserScore: 0,
          recordedAt: '2026-03-14T01:00:00.000Z',
        },
        {
          gameId: 6,
          winnerTeam: 'DAL',
          loserTeam: 'MIN',
          winnerScore: 4,
          loserScore: 1,
          recordedAt: '2026-03-15T01:00:00.000Z',
        },
        {
          gameId: 7,
          winnerTeam: 'DAL',
          loserTeam: 'CGY',
          winnerScore: 1,
          loserScore: 0,
          recordedAt: '2026-03-16T01:00:00.000Z',
        },
      ],
    });

    const owners = {
      BOS: 'Boz',
      TOR: 'Ryan',
      DAL: 'Cooper',
      VAN: 'Terry',
    };

    const { result, unmount } = await mountComposable(() =>
      useChampionTimeline({
        season,
        ownerResolver: (teamAbbrev) => owners[teamAbbrev],
      })
    );

    await result.load();

    expect(getChampionHistory).toHaveBeenCalledWith({
      season: 'season2',
      limit: 200,
    });
    expect(result.entries.value.map((entry) => entry.gameId)).toEqual([
      7, 6, 5, 4, 3, 2, 1,
    ]);
    expect(result.visibleEntries.value).toHaveLength(6);
    expect(result.hasMore.value).toBe(true);
    expect(result.streak.value).toEqual({
      team: 'DAL',
      owner: 'Cooper',
      count: 3,
    });

    result.loadMore();
    expect(result.visibleEntries.value).toHaveLength(7);
    expect(result.hasMore.value).toBe(false);

    await unmount();
  });

  it('returns warning and empty timeline when contract endpoints are disabled', async () => {
    areSeasonContractEndpointsEnabled.mockReturnValue(false);

    const { result, unmount } = await mountComposable(() =>
      useChampionTimeline({ season: 'season2' })
    );

    await result.load();

    expect(result.entries.value).toEqual([]);
    expect(result.error.value).toBe('');
    expect(result.warning.value).toContain(
      'Champion timeline checks are disabled by configuration'
    );

    await unmount();
  });

  it('uses contract fallback warning when history endpoint is unavailable', async () => {
    shouldUseContractFallback.mockReturnValue(true);
    getChampionHistory.mockRejectedValue(new Error('not deployed'));

    const { result, unmount } = await mountComposable(() =>
      useChampionTimeline({ season: 'season2' })
    );

    await result.load();

    expect(result.entries.value).toEqual([]);
    expect(result.error.value).toBe('');
    expect(result.warning.value).toContain(
      'Backend timeline endpoints from this branch are not deployed'
    );

    await unmount();
  });

  it('returns user-facing error when history request fails unexpectedly', async () => {
    shouldUseContractFallback.mockReturnValue(false);
    getChampionHistory.mockRejectedValue(new Error('boom'));

    const { result, unmount } = await mountComposable(() =>
      useChampionTimeline({ season: 'season2' })
    );

    await result.load();

    expect(result.entries.value).toEqual([]);
    expect(result.warning.value).toBe('');
    expect(result.error.value).toContain('Champion timeline is unavailable');

    await unmount();
  });
});
