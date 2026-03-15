import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/nhlApi', () => ({
  default: {
    getGameInfo: vi.fn(),
  },
}));

vi.mock('@/services/championServices', () => ({
  getCurrentChampion: vi.fn(),
  getGameId: vi.fn(),
}));

import nhlApi from '@/services/nhlApi';
import { getCurrentChampion, getGameId } from '@/services/championServices';
import { useCupGameState } from '@/composables/useCupGameState';

describe('useCupGameState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentChampion.mockResolvedValue('TOR');
    getGameId.mockResolvedValue('2024021111');
  });

  function findPlayerByTeam(teamAbbrev) {
    const players = {
      TOR: { name: 'Ryan' },
      BOS: { name: 'Cooper' },
      NYR: { name: 'Terry' },
    };
    return players[teamAbbrev];
  }

  it('refreshes champion and game ids', async () => {
    const state = useCupGameState({ findPlayerByTeam });
    await state.refreshChampionAndGameState();

    expect(state.currentChampion.value).toBe('TOR');
    expect(state.gameID.value).toBe('2024021111');
    expect(state.cupGameId.value).toBe('2024021111');
    expect(state.selectedGameId.value).toBe('2024021111');
    expect(state.homeError.value).toBe('');
  });

  it('sets fallback error when champion/game refresh fails', async () => {
    getCurrentChampion.mockRejectedValueOnce(new Error('failed'));
    const state = useCupGameState({ findPlayerByTeam });

    await state.refreshChampionAndGameState();

    expect(state.homeError.value).toContain(
      'Unable to refresh champion/game status right now'
    );
  });

  it('handles game-info fetch failures gracefully', async () => {
    nhlApi.getGameInfo.mockRejectedValueOnce(new Error('boom'));
    const state = useCupGameState({ findPlayerByTeam });
    state.cupGameId.value = '2024021111';

    await state.getGameInfo();

    expect(state.loading.value).toBe(false);
    expect(state.homeError.value).toContain(
      'Live game details are temporarily unavailable'
    );
  });

  it('handles champion-not-playing game updates', () => {
    const state = useCupGameState({ findPlayerByTeam });
    const onChampionNotPlaying = vi.fn();
    state.currentChampion.value = 'TOR';
    state.setLifecycleHandlers({ onChampionNotPlaying });

    state.applyGameUpdate({
      id: '2024021111',
      gameState: 'LIVE',
      homeTeam: { abbrev: 'BOS', score: 1 },
      awayTeam: { abbrev: 'NYR', score: 0 },
      clock: { secondsRemaining: 512 },
      periodDescriptor: { number: 2 },
      startTimeUTC: '2026-03-15T00:00:00Z',
    });

    expect(state.isGameToday.value).toBe(false);
    expect(onChampionNotPlaying).toHaveBeenCalledTimes(1);
    expect(onChampionNotPlaying.mock.calls[0][0].currentChampionAbbrev).toBe(
      'TOR'
    );
  });

  it('handles final-game transitions and winner/loser mapping', async () => {
    const state = useCupGameState({ findPlayerByTeam });
    const onGameOver = vi.fn();
    state.currentChampion.value = 'TOR';
    state.setLifecycleHandlers({ onGameOver });

    state.applyGameUpdate({
      id: '2024021111',
      gameState: 'FINAL',
      homeTeam: { abbrev: 'TOR', score: 4, commonName: { default: 'Maple' } },
      awayTeam: { abbrev: 'BOS', score: 2, commonName: { default: 'Bruins' } },
      clock: { secondsRemaining: 0 },
      periodDescriptor: { number: 3 },
      startTimeUTC: '2026-03-15T00:00:00Z',
    });

    await nextTick();

    expect(state.isGameToday.value).toBe(true);
    expect(state.isGameOver.value).toBe(true);
    expect(state.todaysWinner.value.abbrev).toBe('TOR');
    expect(state.todaysWinner.value.player).toEqual({ name: 'Ryan' });
    expect(state.todaysLoser.value.abbrev).toBe('BOS');
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onGameOver.mock.calls[0][0].winnerTeamAbbrev).toBe('TOR');
    expect(getCurrentChampion).toHaveBeenCalledWith({ bustCache: true });
  });

  it('handles in-progress updates and computed clock/period state', () => {
    const state = useCupGameState({ findPlayerByTeam });
    const onGameInProgress = vi.fn();
    state.currentChampion.value = 'TOR';
    state.setLifecycleHandlers({ onGameInProgress });

    state.applyGameUpdate({
      id: '2024021111',
      gameState: 'LIVE',
      homeTeam: { abbrev: 'TOR', score: 1, commonName: { default: 'Maple' } },
      awayTeam: { abbrev: 'BOS', score: 1, commonName: { default: 'Bruins' } },
      clock: { secondsRemaining: 492 },
      periodDescriptor: { number: 2 },
      startTimeUTC: '2026-03-15T00:00:00Z',
    });

    expect(state.isGameToday.value).toBe(true);
    expect(state.isGameOver.value).toBe(false);
    expect(state.isGameLive.value).toBe(true);
    expect(state.period.value).toBe(2);
    expect(state.clockTime.value).toBe('08:12');
    expect(onGameInProgress).toHaveBeenCalledTimes(1);
  });
});
