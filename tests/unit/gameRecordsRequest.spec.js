import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/services/apiClient';
import { getGameRecords } from '@/services/dynamodbService';
vi.mock('@/services/apiClient', () => ({ apiRequest: vi.fn() }));

describe('game-record request sharing', () => {
  it('shares simultaneous reads, separates seasons and forced refreshes, and never retains settled data', async () => {
    let finish;
    apiRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const first = getGameRecords({ season: 'season3' });
    const completeFirst = finish;
    expect(getGameRecords({ season: 'season3' })).toBe(first);
    const archived = getGameRecords({ season: 'season2' });
    const completeArchive = finish;
    const forced = getGameRecords({ season: 'season3', bustCache: true });
    const completeForced = finish;
    expect(apiRequest).toHaveBeenCalledTimes(3);
    completeFirst([{ id: 1 }]);
    completeArchive([]);
    completeForced([{ id: 2 }]);
    await Promise.all([first, archived, forced]);
    apiRequest.mockResolvedValueOnce([{ id: 3 }]);
    expect(await getGameRecords({ season: 'season3' })).toEqual([{ id: 3 }]);
  });
  it('allows retry after a failed shared request', async () => {
    apiRequest.mockRejectedValueOnce(new Error('offline'));
    await expect(getGameRecords({ season: 'season3' })).rejects.toThrow(
      'offline'
    );
    apiRequest.mockResolvedValueOnce([]);
    expect(await getGameRecords({ season: 'season3' })).toEqual([]);
  });
});
