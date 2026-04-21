import { describe, expect, it } from 'vitest';
import { selectSeasonChampion } from '@/utilities/seasonChampion';

describe('selectSeasonChampion', () => {
  it('returns null when no players are provided', () => {
    expect(selectSeasonChampion([], 'BOS')).toBeNull();
  });

  it('selects player with highest titleDefenses', () => {
    const players = [
      { name: 'Ryan', titleDefenses: 3, teams: ['TOR'] },
      { name: 'Cooper', titleDefenses: 5, teams: ['BOS'] },
      { name: 'Boz', titleDefenses: 4, teams: ['VGK'] },
    ];

    expect(selectSeasonChampion(players, 'TOR')?.name).toBe('Cooper');
  });

  it('breaks ties by current champion team owner', () => {
    const players = [
      { name: 'Ryan', titleDefenses: 5, teams: ['TOR'] },
      { name: 'Cooper', titleDefenses: 5, teams: ['BOS'] },
    ];

    expect(selectSeasonChampion(players, 'BOS')?.name).toBe('Cooper');
  });

  it('falls back to deterministic alphabetical order on unresolved ties', () => {
    const players = [
      { name: 'Ryan', titleDefenses: 5, teams: ['TOR'] },
      { name: 'Cooper', titleDefenses: 5, teams: ['BOS'] },
    ];

    expect(selectSeasonChampion(players, 'VGK')?.name).toBe('Cooper');
  });
});
