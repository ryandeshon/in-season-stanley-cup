import { mount } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => []);
vi.mock('@/composables/useArcadeSound', () => ({
  audioReady: ref(true),
  soundEnabled: ref(true),
  unlockArcadeSound: async () => {},
  randomCue: (prefix) => `${prefix}1`,
  useArcadeSound: () => ({
    play: async (name) => {
      calls.push([name]);
    },
    sequence: async (names) => {
      calls.push(names);
    },
    stop() {},
  }),
}));
import ArcadeArena from '@/components/arcade/ArcadeArena.vue';
let wrapper;
function setup(owner = 'Ryan') {
  const game = {
    id: 44,
    gameState: 'LIVE',
    homeTeam: { abbrev: 'BOS', score: 1 },
    awayTeam: { abbrev: 'TOR', score: 0 },
    periodDescriptor: { periodType: 'REG' },
  };
  wrapper = mount(ArcadeArena, {
    props: {
      game,
      leftPlayer: { name: owner },
      rightPlayer: { name: 'Cooper' },
      leftTeam: game.homeTeam,
      rightTeam: game.awayTeam,
      season: 'season3',
    },
    global: {
      stubs: {
        TeamLogo: true,
        AttackCanvas: true,
        ExpressivePortrait: true,
        SoundToggle: true,
        RouterLink: true,
      },
    },
  });
  return game;
}
beforeEach(() => {
  calls.length = 0;
  sessionStorage.clear();
  vi.useFakeTimers();
  Object.defineProperty(document, 'hidden', {
    value: false,
    configurable: true,
  });
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});
it('plays a Ryan line then fight only when Ryan is champion, once per game', async () => {
  const game = setup();
  await nextTick();
  expect(calls).toContainEqual(['ryan-talk1', 'fight']);
  await wrapper.setProps({ game: { ...game } });
  expect(calls.filter((c) => c.includes('fight'))).toHaveLength(1);
});
it('starts other champions with fight without a Ryan line', async () => {
  setup('Terry');
  await nextTick();
  expect(calls).toContainEqual(['fight']);
  expect(calls.flat().some((c) => c.startsWith('ryan-talk'))).toBe(false);
});
it('pairs an attack with hurt, then orders the shutout finale and retains Fatality', async () => {
  const game = setup();
  await nextTick();
  calls.length = 0;
  const scored = { ...game, homeTeam: { ...game.homeTeam, score: 2 } };
  await wrapper.setProps({ game: scored, leftTeam: scored.homeTeam });
  expect(calls).toContainEqual(['ryan-attack', 'hurt1']);
  calls.length = 0;
  await wrapper.setProps({ game: { ...scored, gameState: 'FINAL' } });
  expect(calls).toEqual([['finish-him']]);
  expect(wrapper.find('[data-test="flawless-victory"]').exists()).toBe(false);
  await vi.advanceTimersByTimeAsync(1100);
  expect(calls[1]).toEqual(['ryan-attack', 'hurt-final']);
  await vi.advanceTimersByTimeAsync(3100);
  expect(calls[2]).toEqual(['fatality']);
  expect(wrapper.find('[data-test="fatality-overlay"]').exists()).toBe(true);
  await vi.advanceTimersByTimeAsync(1400);
  expect(calls[3]).toEqual(['flawless-victory']);
  expect(wrapper.find('[data-test="flawless-victory"]').exists()).toBe(true);
  await wrapper.setProps({ game: { ...scored, gameState: 'OFF' } });
  expect(calls).toHaveLength(4);
});
