import { describe, it, expect, vi } from 'vitest';
import { effectScope, ref } from 'vue';
const audio = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn() }));
vi.mock('@/composables/useArcadeSound', () => ({
  useArcadeSound: () => audio,
  randomCue: () => 'draft-pick2',
}));
import { useDraftPickSound } from '@/composables/useDraftPickSound';
describe('draft pick audio', () => {
  it('plays once for accepted new picks, never for initial history, repeats, undo, reset or old seasons', () => {
    const scope = effectScope();
    const state = ref(null);
    let enabled = true;
    scope.run(() => useDraftPickSound(state, () => enabled));
    state.value = { version: 5, pickHistory: [{}, {}] };
    expect(audio.play).not.toHaveBeenCalled();
    state.value = { version: 6, pickHistory: [{}, {}, {}] };
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('draft-pick2');
    state.value = { version: 6, pickHistory: [{}, {}, {}] };
    state.value = { version: 7, pickHistory: [{}, {}] };
    state.value = { version: 8, pickHistory: [] };
    enabled = false;
    state.value = { version: 9, pickHistory: [{}] };
    expect(audio.play).toHaveBeenCalledTimes(1);
    scope.stop();
  });
});
