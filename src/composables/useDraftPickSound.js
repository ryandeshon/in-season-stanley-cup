import { watch } from 'vue';
import { randomCue, useArcadeSound } from './useArcadeSound';

// Observe accepted state so player picks and admin auto-picks sound once,
// including picks received through live updates. Loading old picks is silent.
export function useDraftPickSound(state, enabled) {
  const sound = useArcadeSound();
  watch(
    state,
    (next, previous) => {
      if (
        enabled() &&
        previous &&
        next &&
        Number(next.version) > Number(previous.version) &&
        (next.pickHistory?.length || 0) > (previous.pickHistory?.length || 0)
      ) {
        sound.stop();
        sound.play(randomCue('draft-pick', 3));
      }
    },
    { flush: 'sync' }
  );
}
