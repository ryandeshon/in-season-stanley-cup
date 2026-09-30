import { mount } from '@vue/test-utils';
import { defineComponent, ref, nextTick } from 'vue';
import { it, expect, vi } from 'vitest';
const calls = vi.hoisted(() => []);
vi.mock('@/services/socketClient', async () => {
  const { ref } = await import('vue');
  const lastMessage = ref(null),
    isConnected = ref(true);
  return {
    initSocket: vi.fn(),
    useSocket: () => ({ lastMessage, isConnected }),
    lastMessage,
  };
});
vi.mock('@/composables/useArcadeSound', () => ({
  audioReady: ref(true),
  soundEnabled: ref(true),
  unlockArcadeSound: async () => {},
  randomCue: (p) => `${p}1`,
  useArcadeSound: () => ({
    stop() {},
    play: async (n) => calls.push([n]),
    sequence: async (n) => calls.push(n),
  }),
}));
import { lastMessage } from '@/services/socketClient';
import { useLiveGameFeed } from '@/composables/useLiveGameFeed';
import ArcadeArena from '@/components/arcade/ArcadeArena.vue';
it('drives projectile and sound through the real socket message watcher at one-minute cadence', async () => {
  vi.useFakeTimers();
  sessionStorage.clear();
  Object.defineProperty(document, 'hidden', {
    value: false,
    configurable: true,
  });
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  const initial = {
    id: 71,
    gameState: 'LIVE',
    homeTeam: { abbrev: 'CAR', score: 0 },
    awayTeam: { abbrev: 'FLA', score: 0 },
  };
  const Harness = defineComponent({
    components: { ArcadeArena },
    setup() {
      const game = ref(initial);
      useLiveGameFeed({
        cupGameId: ref(71),
        selectedGameId: ref(71),
        applyGameUpdate: (data) => (game.value = data),
      });
      return { game };
    },
    template: `<ArcadeArena :game="game" :left-team="game.homeTeam" :right-team="game.awayTeam" :left-player="{name:'Ryan'}" :right-player="{name:'Cooper'}" season="season3" />`,
  });
  const wrapper = mount(Harness, {
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
  try {
    await vi.advanceTimersByTimeAsync(60000);
    calls.length = 0;
    lastMessage.value = {
      type: 'liveGameUpdate',
      payload: { ...initial, awayTeam: { abbrev: 'FLA', score: 1 } },
    };
    await nextTick();
    expect(calls).toContainEqual(['cooper-attack', 'hurt1']);
    await vi.advanceTimersByTimeAsync(150);
    expect(wrapper.find('.arcade-arena').classes()).toContain('phase-travel');
    expect(wrapper.find('.arcade-arena').classes()).toContain('from-right');
    lastMessage.value = {
      type: 'liveGameUpdate',
      payload: { ...initial, id: 999, homeTeam: { abbrev: 'CAR', score: 9 } },
    };
    await nextTick();
    expect(calls.filter((c) => c[0] === 'cooper-attack')).toHaveLength(1);
  } finally {
    wrapper.unmount();
    vi.useRealTimers();
  }
});
