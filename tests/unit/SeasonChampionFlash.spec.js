import { mount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import SeasonChampionFlash from '@/components/SeasonChampionFlash.vue';

function createMatchMediaMock(matches = false) {
  return vi.fn().mockImplementation(() => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function mountFlash() {
  return mount(SeasonChampionFlash, {
    props: {
      player: {
        name: 'Ryan',
        teams: ['VGK', 'TOR'],
      },
      championImageSrc: '/assets/players/season2/ryan-winner.webp',
      quote: 'Suck It Nerds',
    },
    global: {
      stubs: {
        TeamLogo: {
          props: ['team'],
          template: '<div :data-test="`team-${team}`"></div>',
        },
      },
    },
    attachTo: document.body,
    shallow: false,
  });
}

describe('SeasonChampionFlash.vue', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders champion image and animated quote text', async () => {
    window.matchMedia = createMatchMediaMock(false);

    const wrapper = mountFlash();
    await vi.waitFor(() => {
      expect(wrapper.find('[data-test="season-champion-flash"]').exists()).toBe(
        true
      );
    });

    const image = wrapper.get('[data-test="season-champion-flash-image"]');
    expect(image.attributes('src')).toContain('ryan-winner.webp');
    expect(
      wrapper
        .get('[data-test="season-champion-flash-quote"]')
        .text()
        .replace(/\u00a0/g, ' ')
    ).toBe('Suck It Nerds');
  });

  it('uses reduced-motion fallback without transform-based image motion', async () => {
    window.matchMedia = createMatchMediaMock(true);

    const wrapper = mountFlash();
    await vi.waitFor(() => {
      expect(wrapper.find('[data-test="season-champion-flash"]').exists()).toBe(
        true
      );
    });

    expect(
      wrapper.get('[data-test="season-champion-flash"]').classes()
    ).toContain('is-reduced-motion');
    expect(wrapper.get('.flash-image-wrap').attributes('style')).toContain(
      'transform: none;'
    );
  });
});
