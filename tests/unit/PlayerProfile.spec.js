import { nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/composables/usePlayerSeasonData', () => ({
  usePlayerSeasonData: vi.fn(),
}));

import { usePlayerSeasonData } from '@/composables/usePlayerSeasonData';
import PlayerProfile from '@/pages/PlayerProfile.vue';

const passthroughStub = {
  template: '<div><slot /></div>',
};

const globalMountOptions = {
  stubs: {
    'v-container': passthroughStub,
    'v-alert': passthroughStub,
    'v-card': passthroughStub,
    'v-card-title': passthroughStub,
    'v-card-text': passthroughStub,
    'v-table': {
      template: '<table><slot /></table>',
    },
    'v-btn': {
      template: '<button><slot /></button>',
    },
    'v-progress-circular': {
      template: '<div data-test="loading-spinner" />',
    },
    PlayerCard: {
      template: '<div data-test="player-card-stub" />',
    },
    TeamLogo: {
      props: ['team'],
      template: '<span data-test="team-logo-stub">{{ team }}</span>',
    },
    RouterLink: {
      template: '<a><slot /></a>',
    },
  },
};

function mockSeasonData({
  loading = false,
  error = null,
  player = null,
  gameRecords = [],
} = {}) {
  usePlayerSeasonData.mockReturnValue({
    loading: ref(loading),
    error: ref(error),
    player: ref(player),
    gameRecords: ref(gameRecords),
  });
}

function mountProfile() {
  return mount(PlayerProfile, {
    props: { name: 'Ryan' },
    global: globalMountOptions,
  });
}

describe('PlayerProfile.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', async () => {
    mockSeasonData({
      loading: true,
    });

    const wrapper = mountProfile();
    await nextTick();

    expect(wrapper.find('[data-test="loading-spinner"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="player-profile-error"]').exists()).toBe(
      false
    );
  });

  it('renders error state when profile data fails', async () => {
    mockSeasonData({
      error: new Error('boom'),
      player: null,
    });

    const wrapper = mountProfile();
    await nextTick();

    expect(wrapper.find('[data-test="player-profile-error"]').exists()).toBe(
      true
    );
    expect(wrapper.text()).toContain(
      'Unable to load this player profile right now. Please try again shortly.'
    );
  });

  it('renders empty-player state when no player payload is available', async () => {
    mockSeasonData({
      player: null,
      gameRecords: [],
    });

    const wrapper = mountProfile();
    await nextTick();

    expect(wrapper.find('[data-test="player-profile-empty"]').exists()).toBe(
      true
    );
  });

  it('renders trend panel empty state when player has no game records', async () => {
    mockSeasonData({
      player: {
        name: 'Ryan',
        teams: ['TOR'],
        titleDefenses: 0,
      },
      gameRecords: [],
    });

    const wrapper = mountProfile();
    await nextTick();

    expect(
      wrapper.find('[data-test="player-profile-trend-panel"]').exists()
    ).toBe(true);
    expect(wrapper.text()).toContain(
      'No trend data available yet for this player.'
    );
    expect(wrapper.find('[data-test="player-profile-no-games"]').exists()).toBe(
      true
    );
  });

  it('renders trend metrics for players with game history', async () => {
    mockSeasonData({
      player: {
        name: 'Ryan',
        teams: ['TOR', 'BOS'],
        titleDefenses: 2,
      },
      gameRecords: [
        { id: 4, wTeam: 'TOR', lTeam: 'NYR' },
        { id: 3, wTeam: 'FLA', lTeam: 'BOS' },
        { id: 2, wTeam: 'TOR', lTeam: 'BOS' },
      ],
    });

    const wrapper = mountProfile();
    await nextTick();

    expect(
      wrapper.get('[data-test="player-profile-trend-last10"]').text()
    ).toContain('1-1-1');
    expect(
      wrapper.get('[data-test="player-profile-trend-last10"]').text()
    ).toContain('50.0%');

    expect(
      wrapper.get('[data-test="player-profile-trend-best-team"]').text()
    ).toContain('TOR (100.0%)');
    expect(
      wrapper.get('[data-test="player-profile-trend-weakest-matchup"]').text()
    ).toContain('FLA (0.0%)');
  });
});
