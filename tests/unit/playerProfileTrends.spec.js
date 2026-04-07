import { describe, expect, it } from 'vitest';
import {
  buildHeadToHeadSummaries,
  buildPlayerGameHistory,
  getBestPerformingTeam,
  getHeadToHeadAvatarType,
  getPlayerProfileTrends,
  getWeakestMatchup,
  sortGamesByRecency,
  summarizeLastTenForm,
} from '@/utilities/playerProfileTrends';

describe('playerProfileTrends', () => {
  it('sorts by numeric game id descending when ids are comparable', () => {
    const sorted = sortGamesByRecency([
      { id: 2, wTeam: 'TOR', lTeam: 'BOS' },
      { id: 9, wTeam: 'TOR', lTeam: 'MTL' },
      { id: 5, wTeam: 'TOR', lTeam: 'NYR' },
    ]);

    expect(sorted.map((game) => game.id)).toEqual([9, 5, 2]);
  });

  it('falls back to timestamp sorting when game ids are not comparable', () => {
    const sorted = sortGamesByRecency([
      { id: 'a1', savedAt: '2026-03-11T05:00:00Z' },
      { id: 'a2', savedAt: '2026-03-13T05:00:00Z' },
      { id: 'a3', savedAt: '2026-03-12T05:00:00Z' },
    ]);

    expect(sorted.map((game) => game.id)).toEqual(['a2', 'a3', 'a1']);
  });

  it('computes last-10 form with mirrors excluded from win percentage denominator', () => {
    const summary = summarizeLastTenForm(
      [
        { id: 12, wTeam: 'TOR', lTeam: 'NYR' },
        { id: 11, wTeam: 'MTL', lTeam: 'BOS' },
        { id: 10, wTeam: 'TOR', lTeam: 'BOS' },
        { id: 9, wTeam: 'DAL', lTeam: 'MIN' },
        { id: 8, wTeam: 'BOS', lTeam: 'DET' },
        { id: 7, wTeam: 'FLA', lTeam: 'TOR' },
        { id: 6, wTeam: 'BOS', lTeam: 'TOR' },
        { id: 5, wTeam: 'TOR', lTeam: 'CAR' },
        { id: 4, wTeam: 'TBL', lTeam: 'BOS' },
        { id: 3, wTeam: 'BOS', lTeam: 'SEA' },
        { id: 2, wTeam: 'TOR', lTeam: 'ANA' },
        { id: 1, wTeam: 'NYI', lTeam: 'TOR' },
      ],
      ['TOR', 'BOS']
    );

    expect(summary.gamesConsidered).toBe(10);
    expect(summary.record).toBe('5-3-2');
    expect(summary.winPct).toBeCloseTo(0.625, 5);
  });

  it('resolves best team with deterministic tie-breakers', () => {
    const bestTeam = getBestPerformingTeam(
      [
        { id: 8, wTeam: 'TOR', lTeam: 'NYR' },
        { id: 7, wTeam: 'TOR', lTeam: 'DET' },
        { id: 6, wTeam: 'TOR', lTeam: 'LAK' },
        { id: 5, wTeam: 'VAN', lTeam: 'TOR' },
        { id: 4, wTeam: 'BOS', lTeam: 'NYR' },
        { id: 3, wTeam: 'BOS', lTeam: 'DET' },
        { id: 2, wTeam: 'BOS', lTeam: 'LAK' },
        { id: 1, wTeam: 'VAN', lTeam: 'BOS' },
      ],
      ['TOR', 'BOS']
    );

    expect(bestTeam).toMatchObject({
      team: 'BOS',
      wins: 3,
      losses: 1,
      games: 4,
    });
  });

  it('resolves weakest matchup with deterministic tie-breakers', () => {
    const weakest = getWeakestMatchup(
      [
        { id: 9, wTeam: 'TOR', lTeam: 'NYR' },
        { id: 8, wTeam: 'NYR', lTeam: 'TOR' },
        { id: 7, wTeam: 'NYR', lTeam: 'TOR' },
        { id: 6, wTeam: 'TOR', lTeam: 'DET' },
        { id: 5, wTeam: 'DET', lTeam: 'TOR' },
        { id: 4, wTeam: 'DET', lTeam: 'TOR' },
      ],
      ['TOR']
    );

    expect(weakest).toMatchObject({
      team: 'DET',
      wins: 1,
      losses: 2,
      games: 3,
    });
  });

  it('returns null split summaries when no non-mirror games are available', () => {
    const trends = getPlayerProfileTrends(
      [
        { id: 3, wTeam: 'TOR', lTeam: 'BOS' },
        { id: 2, wTeam: 'BOS', lTeam: 'TOR' },
      ],
      ['TOR', 'BOS']
    );

    expect(trends.lastTen.record).toBe('0-0-2');
    expect(trends.lastTen.winPct).toBeNull();
    expect(trends.bestTeam).toBeNull();
    expect(trends.weakestMatchup).toBeNull();
  });

  it('filters history to owned teams and normalizes legacy WIN -> WPG alias', () => {
    const history = buildPlayerGameHistory(
      [
        { id: 3, wTeam: 'BOS', lTeam: 'TOR' },
        { id: 2, wTeam: 'WIN', lTeam: 'SEA' },
        { id: 1, wTeam: 'DAL', lTeam: 'WIN' },
      ],
      ['WPG']
    );

    expect(history.map((game) => game.id)).toEqual([2, 1]);
  });

  it('maps head-to-head avatar types from record differential', () => {
    expect(getHeadToHeadAvatarType(3, 1)).toBe('Angry');
    expect(getHeadToHeadAvatarType(1, 3)).toBe('Happy');
    expect(getHeadToHeadAvatarType(2, 2)).toBe('Sad');
  });

  it('builds alphabetical head-to-head summaries and excludes mirror/unknown games', () => {
    const summaries = buildHeadToHeadSummaries({
      profilePlayerName: 'Ryan',
      players: [
        { name: 'Ryan', teams: ['TOR', 'BOS'] },
        { name: 'Boz', teams: ['DET', 'LAK'] },
        { name: 'Cooper', teams: ['NYR', 'DAL'] },
        { name: 'Terry', teams: ['SEA', 'WPG'] },
      ],
      gameRecords: [
        { id: 9, wTeam: 'TOR', lTeam: 'DET' },
        { id: 8, wTeam: 'NYR', lTeam: 'BOS' },
        { id: 7, wTeam: 'TOR', lTeam: 'NYR' },
        { id: 6, wTeam: 'DET', lTeam: 'BOS' },
        { id: 5, wTeam: 'TOR', lTeam: 'BOS' },
        { id: 4, wTeam: 'DAL', lTeam: 'SEA' },
        { id: 3, wTeam: 'WIN', lTeam: 'TOR' },
        { id: 2, wTeam: 'TOR', lTeam: 'VAN' },
      ],
    });

    expect(summaries).toEqual([
      {
        opponentName: 'Boz',
        wins: 1,
        losses: 1,
        avatarType: 'Sad',
      },
      {
        opponentName: 'Cooper',
        wins: 1,
        losses: 1,
        avatarType: 'Sad',
      },
      {
        opponentName: 'Terry',
        wins: 0,
        losses: 1,
        avatarType: 'Happy',
      },
    ]);
  });

  it('keeps opponents with no games as 0-0 with Sad avatars', () => {
    const summaries = buildHeadToHeadSummaries({
      profilePlayerName: 'Ryan',
      players: [
        { name: 'Ryan', teams: ['TOR'] },
        { name: 'Boz', teams: ['DET'] },
        { name: 'Cooper', teams: ['SEA'] },
      ],
      gameRecords: [{ id: 1, wTeam: 'TOR', lTeam: 'VAN' }],
    });

    expect(summaries).toEqual([
      {
        opponentName: 'Boz',
        wins: 0,
        losses: 0,
        avatarType: 'Sad',
      },
      {
        opponentName: 'Cooper',
        wins: 0,
        losses: 0,
        avatarType: 'Sad',
      },
    ]);
  });
});
