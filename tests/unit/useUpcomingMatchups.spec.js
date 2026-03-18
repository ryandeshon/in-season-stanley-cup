import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/nhlApi', () => ({
  default: {
    getSchedule: vi.fn(),
  },
}));

import nhlApi from '@/services/nhlApi';
import { useUpcomingMatchups } from '@/composables/useUpcomingMatchups';

describe('useUpcomingMatchups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createComposable(overrides = {}) {
    const todaysGame = ref({
      startTimeUTC: '2026-03-15T00:00:00Z',
    });
    const todaysWinner = ref({ abbrev: 'TOR' });
    const cupGameId = ref('2024021111');
    const selectedGameId = ref(null);
    const playerChampion = ref({
      name: 'Ryan',
      championTeam: { abbrev: 'TOR' },
    });
    const playerChallenger = ref({
      name: 'Cooper',
      challengerTeam: { abbrev: 'BOS' },
    });
    const findPlayerByTeam = (teamAbbrev) => ({ name: `${teamAbbrev}-owner` });

    const composable = useUpcomingMatchups({
      todaysGame,
      todaysWinner,
      cupGameId,
      selectedGameId,
      playerChampion,
      playerChallenger,
      findPlayerByTeam,
      ...overrides,
    });

    return {
      composable,
      refs: {
        todaysGame,
        todaysWinner,
        cupGameId,
        selectedGameId,
        playerChampion,
        playerChallenger,
      },
    };
  }

  it('loads matchup options for the active cup game and sets selected game id', async () => {
    nhlApi.getSchedule.mockResolvedValue({
      data: {
        gameWeek: [
          {
            date: '2026-03-15',
            games: [
              {
                id: 2024021111,
                awayTeam: { abbrev: 'TOR' },
                homeTeam: { abbrev: 'BOS' },
              },
            ],
          },
        ],
      },
    });

    const { composable, refs } = createComposable();
    await composable.loadMatchupOptions();

    expect(composable.matchupOptions.value).toEqual([
      {
        id: '2024021111',
        label: 'TOR @ BOS (Cup Defense)',
      },
    ]);
    expect(refs.selectedGameId.value).toBe('2024021111');
    expect(composable.matchupOptionsLoading.value).toBe(false);
  });

  it('falls back to generic cup matchup option on schedule error', async () => {
    nhlApi.getSchedule.mockRejectedValue(new Error('schedule failed'));

    const { composable } = createComposable();
    await composable.loadMatchupOptions();

    expect(composable.matchupOptions.value).toEqual([
      {
        id: '2024021111',
        label: 'Cup Matchup (2024021111)',
      },
    ]);
    expect(composable.matchupOptionsLoading.value).toBe(false);
  });

  it('filters and sorts winner-conditional matchups', async () => {
    nhlApi.getSchedule.mockResolvedValue({
      data: {
        gameWeek: [
          {
            date: '2026-03-16',
            games: [
              {
                id: 3,
                startTimeUTC: '2026-03-16T23:00:00Z',
                homeTeam: { abbrev: 'BOS' },
                awayTeam: { abbrev: 'TOR' },
              },
              {
                id: 1,
                startTimeUTC: '2026-03-16T17:00:00Z',
                homeTeam: { abbrev: 'TOR' },
                awayTeam: { abbrev: 'NYR' },
              },
            ],
          },
          {
            date: '2026-03-17',
            games: [
              {
                id: 2,
                startTimeUTC: '2026-03-17T18:00:00Z',
                homeTeam: { abbrev: 'MTL' },
                awayTeam: { abbrev: 'OTT' },
              },
            ],
          },
        ],
      },
    });

    const { composable } = createComposable();
    await composable.handleWinnerSelection('champion');

    expect(composable.selectedWinnerRole.value).toBe('champion');
    expect(composable.conditionalMatchupsHeading.value).toContain(
      'If Ryan Wins Tonight'
    );
    expect(composable.conditionalMatchups.value.map((game) => game.id)).toEqual(
      [1, 3]
    );
    expect(composable.conditionalMatchupsLoading.value).toBe(false);
  });

  it('resets conditional matchup state', () => {
    const { composable } = createComposable();

    composable.selectedWinnerRole.value = 'challenger';
    composable.conditionalMatchups.value = [{ id: 1 }];
    composable.conditionalMatchupsLoading.value = true;

    composable.resetConditionalMatchups();

    expect(composable.selectedWinnerRole.value).toBe('');
    expect(composable.conditionalMatchups.value).toEqual([]);
    expect(composable.conditionalMatchupsLoading.value).toBe(false);
  });

  it('handles invalid possible-matchup schedule payloads', async () => {
    nhlApi.getSchedule.mockResolvedValue({
      data: {
        gameWeek: null,
      },
    });

    const { composable } = createComposable();
    await composable.getPossibleMatchUps('TOR');

    expect(composable.possibleMatchUps.value).toEqual([]);
    expect(composable.potentialLoading.value).toBe(false);
  });

  it('uses reference date and only includes same-week games on or after target date', async () => {
    nhlApi.getSchedule.mockResolvedValue({
      data: {
        gameWeek: [
          {
            date: '2026-03-15',
            games: [
              {
                id: 8,
                startTimeUTC: '2026-03-15T23:00:00Z',
                homeTeam: { abbrev: 'TOR' },
                awayTeam: { abbrev: 'BOS' },
              },
            ],
          },
          {
            date: '2026-03-16',
            games: [
              {
                id: 3,
                startTimeUTC: '2026-03-16T23:00:00Z',
                homeTeam: { abbrev: 'BOS' },
                awayTeam: { abbrev: 'TOR' },
              },
              {
                id: 1,
                startTimeUTC: '2026-03-16T17:00:00Z',
                homeTeam: { abbrev: 'TOR' },
                awayTeam: { abbrev: 'NYR' },
              },
            ],
          },
          {
            date: '2026-03-17',
            games: [
              {
                id: 2,
                startTimeUTC: '2026-03-17T18:00:00Z',
                homeTeam: { abbrev: 'MTL' },
                awayTeam: { abbrev: 'TOR' },
              },
            ],
          },
        ],
      },
    });

    const { composable } = createComposable();
    await composable.getPossibleMatchUps('TOR', {
      referenceDate: '2026-03-15T05:00:00Z',
    });

    expect(nhlApi.getSchedule).toHaveBeenCalledWith('2026-03-16');
    expect(composable.possibleMatchUps.value.map((game) => game.id)).toEqual([
      1, 3, 2,
    ]);
  });

  it('falls back to today when an invalid reference date is provided', async () => {
    nhlApi.getSchedule.mockResolvedValue({
      data: {
        gameWeek: [],
      },
    });

    const { composable } = createComposable();
    await composable.getPossibleMatchUps('TOR', {
      referenceDate: 'not-a-date',
    });

    expect(nhlApi.getSchedule).toHaveBeenCalledTimes(1);
  });

  it('derives first non-champion team owner from upcoming games', () => {
    const { composable } = createComposable();

    composable.possibleMatchUps.value = [
      {
        id: 99,
        dateTime: '03/16 7:00 PM',
        homeTeam: { abbrev: 'TOR' },
        awayTeam: { abbrev: 'BOS' },
      },
    ];

    expect(composable.firstGameNonChampionTeam.value).toEqual({
      date: '03/16 7:00 PM',
      team: { abbrev: 'BOS' },
      player: { name: 'BOS-owner' },
    });
  });
});
