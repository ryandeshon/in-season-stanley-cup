import { watch } from 'vue';
import {
  randomCue,
  useArcadeSound,
  soundEnabled,
  audioReady,
} from './useArcadeSound';
import { claimDraftPickAudio } from '@/utilities/draftAudioClaim';

// Observe accepted state so player picks and admin auto-picks sound once,
// including picks received through live updates. Loading old picks is silent.
export function useDraftPickSound(state, enabled) {
  const sound = useArcadeSound();
  const observed = new Set();
  watch(
    state,
    async (next, previous) => {
      if (
        enabled() &&
        previous &&
        next &&
        Number(next.version) > Number(previous.version) &&
        (next.pickHistory?.length || 0) > (previous.pickHistory?.length || 0)
      ) {
        const pick = next.pickHistory.at(-1);
        const eventId = JSON.stringify([
          next.version,
          pick?.playerId,
          pick?.team,
          pick?.pickedAt,
        ]);
        if (observed.has(eventId)) return;
        observed.add(eventId);
        if (!soundEnabled.value || !audioReady.value || document.hidden) return;
        if (!(await claimDraftPickAudio(eventId))) return;
        sound.stop();
        sound.play(randomCue('draft-pick', 3));
      }
    },
    { flush: 'sync' }
  );
}
