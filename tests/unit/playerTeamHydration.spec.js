import { describe, expect, it } from 'vitest';
import {
  hydratePlayerTeam,
  hydratePlayerTeams,
} from '@/utilities/playerTeamHydration';

describe('playerTeamHydration', () => {
  it('hydrates missing teams from fallback player mapping', () => {
    const players = [
      { id: 2, name: 'Terry', titleDefenses: 1 },
      { id: 0, name: 'Ryan', titleDefenses: 0 },
    ];

    const hydrated = hydratePlayerTeams(players, 'season1');

    expect(hydrated[0].teams).toContain('NJD');
    expect(hydrated[1].teams).toContain('WPG');
    expect(hydrated[1].teams).not.toContain('WIN');
  });

  it('preserves non-empty API teams', () => {
    const player = {
      id: 2,
      name: 'Terry',
      teams: ['NJD', 'COL'],
      titleDefenses: 2,
    };

    const hydrated = hydratePlayerTeam(player);

    expect(hydrated.teams).toEqual(['NJD', 'COL']);
  });

  it('normalizes legacy WIN abbreviations to WPG', () => {
    const player = {
      id: 9,
      name: 'Legacy',
      teams: ['WIN', 'BOS'],
    };

    const hydrated = hydratePlayerTeam(player);

    expect(hydrated.teams).toEqual(['WPG', 'BOS']);
  });

  it('falls back by player name when id is unavailable', () => {
    const player = {
      name: '  terry ',
      championships: 0,
    };

    expect(hydratePlayerTeam(player, 'season1').teams).toContain('NJD');
  });

  it('keeps empty rosters and does not leak historical teams to a new season', () => {
    expect(hydratePlayerTeam({ id: '0', teams: [] }, 'season1')).toEqual({
      id: 0,
      teams: [],
    });
    expect(hydratePlayerTeam({ id: '0' }, 'season3').teams).toEqual([]);
  });

  it('guarantees teams is an array when no fallback exists', () => {
    const player = {
      id: 999,
      name: 'Unknown',
    };

    const hydrated = hydratePlayerTeam(player);

    expect(Array.isArray(hydrated.teams)).toBe(true);
    expect(hydrated.teams).toEqual([]);
  });
});
