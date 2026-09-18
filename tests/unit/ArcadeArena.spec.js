import { mount } from '@vue/test-utils';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import ArcadeArena from '@/components/arcade/ArcadeArena.vue';
const attacks = {
  Ryan: 'fire',
  Cooper: 'lightning',
  Boz: 'orb',
  Terry: 'acid',
};
const names = Object.keys(attacks);
const pairings = names.flatMap((a) =>
  names
    .filter((b) => b !== a)
    .flatMap((b) => [
      [a, b, 'left'],
      [a, b, 'right'],
    ])
);
let wrappers = [];
function mountArena(left = 'Ryan', right = 'Cooper') {
  const game = {
    id: 71,
    gameState: 'LIVE',
    homeTeam: { abbrev: 'BOS', score: 1 },
    awayTeam: { abbrev: 'TOR', score: 1 },
    periodDescriptor: { periodType: 'REG' },
    clock: { inIntermission: false },
  };
  const wrapper = mount(ArcadeArena, {
    props: {
      game,
      leftTeam: game.homeTeam,
      rightTeam: game.awayTeam,
      leftPlayer: { name: left },
      rightPlayer: { name: right },
      season: 'season3',
    },
    global: {
      stubs: {
        AttackCanvas: true,
        TeamLogo: true,
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, game };
}
beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  wrappers.forEach((w) => w.unmount());
  wrappers = [];
  vi.useRealTimers();
});
describe('reusable arena choreography', () => {
  it.each([
    ['Ryan', 'The Black Rink'],
    ['Cooper', 'Thunderkeep Ice'],
    ['Boz', 'The Spotlight Pit'],
    ['Terry', 'The Venom Vault'],
    ['Unknown', 'The Portal Rink'],
  ])(
    'hosts %s in %s and transfers the arena on a confirmed loss',
    async (owner, arenaName) => {
      const { wrapper, game } = mountArena(owner, 'Cooper');
      expect(wrapper.find('.arena-topline .eyebrow').text()).toBe(arenaName);
      const final = {
        ...game,
        gameState: 'FINAL',
        awayTeam: { ...game.awayTeam, score: 2 },
      };
      await wrapper.setProps({ game: final, rightTeam: final.awayTeam });
      expect(wrapper.find('.arena-topline .eyebrow').text()).toBe(
        'Thunderkeep Ice'
      );
      expect(wrapper.find('.victory-heading h2').text()).toBe('Cooper');
      expect(wrapper.find('.victory-heading small').exists()).toBe(false);
    }
  );
  it('labels an unconfirmed final without awarding a winner or showing invalid scores', async () => {
    const { wrapper, game } = mountArena();
    const final = {
      ...game,
      gameState: 'FINAL',
      homeTeam: { abbrev: 'BOS', score: -1 },
    };
    await wrapper.setProps({ game: final, leftTeam: final.homeTeam });
    expect(wrapper.find('.arena-status').text()).toBe('FINAL');
    expect(wrapper.find('.hud-score').text()).toContain(
      'AWAITING CONFIRMATION'
    );
    expect(wrapper.find('.hud-score strong').text()).toContain('—');
    expect(wrapper.find('.victory-heading').exists()).toBe(false);
  });
  it.each(pairings)(
    '%s / %s scores from %s with correct effect and receiver',
    async (left, right, side) => {
      const { wrapper, game } = mountArena(left, right);
      const updated = structuredClone(game);
      updated[side === 'left' ? 'homeTeam' : 'awayTeam'].score++;
      await wrapper.setProps({
        game: updated,
        leftTeam: updated.homeTeam,
        rightTeam: updated.awayTeam,
      });
      expect(wrapper.classes()).toContain(
        `attack-${attacks[side === 'left' ? left : right]}`
      );
      expect(wrapper.classes()).toContain('phase-windup');
      expect(
        wrapper.find('.is-receiver .portrait-visual').attributes('data-emotion')
      ).toBe('Happy');
      expect(wrapper.find('.hud-score').text()).toContain('2');
      expect(wrapper.find('.is-attacker').classes()).toContain(side);
      expect(wrapper.find('.is-receiver').classes()).toContain(
        side === 'left' ? 'right' : 'left'
      );
      await vi.advanceTimersByTimeAsync(150);
      expect(wrapper.classes()).toContain('phase-travel');
      await vi.advanceTimersByTimeAsync(250);
      expect(wrapper.classes()).toContain('phase-impact');
      expect(
        wrapper.find('.is-receiver .portrait-visual').attributes('data-emotion')
      ).toBe('Anguish');
      expect(
        wrapper.find('.is-attacker .portrait-visual').attributes('data-emotion')
      ).toBe('Happy');
      await vi.advanceTimersByTimeAsync(1000);
      expect(wrapper.classes()).toContain('phase-idle');
      expect(
        wrapper
          .find(
            `.fighter.${side === 'left' ? 'right' : 'left'} .portrait-visual`
          )
          .attributes('data-emotion')
      ).toBe('Angry');
    }
  );
  it('shows static final results, retains profile links and suppresses mirror fatality', async () => {
    const { wrapper, game } = mountArena('Ryan', 'Ryan');
    const final = {
      ...game,
      gameState: 'FINAL',
      homeTeam: { abbrev: 'BOS', score: 3 },
      awayTeam: { abbrev: 'TOR', score: 0 },
    };
    await wrapper.setProps({
      game: final,
      leftTeam: final.homeTeam,
      rightTeam: final.awayTeam,
    });
    expect(wrapper.text()).toContain('MIRROR MATCH RESOLVED');
    expect(wrapper.text()).toContain('FLAWLESS VICTORY');
    expect(
      wrapper.find('.fighter.left .portrait-visual').attributes('data-emotion')
    ).toBe('Happy');
    expect(
      wrapper.find('.fighter.right .portrait-visual').attributes('data-emotion')
    ).toBe('Sad');
    expect(wrapper.text()).not.toContain('Replay fatality');
    expect(wrapper.classes()).toContain('phase-idle');
    expect(wrapper.findAll('.fighter-label a')).toHaveLength(2);
  });
  it('reduced motion uses static impact and sound starts off', async () => {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { wrapper, game } = mountArena();
    expect(wrapper.text()).toContain('Sound off');
    await wrapper.setProps({
      game: { ...game, homeTeam: { abbrev: 'BOS', score: 2 } },
    });
    expect(wrapper.classes()).toContain('phase-impact');
    expect(wrapper.classes()).toContain('reduced-motion');
    await vi.advanceTimersByTimeAsync(700);
    expect(wrapper.classes()).toContain('phase-idle');
  });
  it('cancels attacks on final and does not restart finishes on repeated polls', async () => {
    const { wrapper, game } = mountArena();
    const scoring = { ...game, homeTeam: { abbrev: 'BOS', score: 2 } };
    await wrapper.setProps({ game: scoring, leftTeam: scoring.homeTeam });
    const final = { ...scoring, gameState: 'FINAL' };
    await wrapper.setProps({ game: final });
    expect(wrapper.classes()).toContain('phase-finish');
    await vi.advanceTimersByTimeAsync(500);
    await wrapper.setProps({ game: { ...final, gameState: 'OFF' } });
    expect(wrapper.classes()).toContain('phase-finish');
    await vi.advanceTimersByTimeAsync(2000);
    expect(wrapper.classes()).toContain('phase-idle');
  });
});
