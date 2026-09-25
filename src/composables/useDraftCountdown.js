import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';

import { useArcadeSound } from '@/composables/useArcadeSound';

export function useDraftCountdown(
  draftState,
  isDraftOver,
  arcade = () => false
) {
  const ticks = useArcadeSound();
  const nowMs = ref(Date.now());
  let timer;
  const autoPickSecondsRemaining = computed(() => {
    if (!draftState.value?.autoPickEnabled) return null;
    const deadline = Date.parse(draftState.value.autoPickDeadlineAt || '');
    return Number.isFinite(deadline)
      ? Math.max(0, Math.ceil((deadline - nowMs.value) / 1000))
      : null;
  });
  const showAutoPickCountdown = computed(
    () =>
      Boolean(draftState.value?.draftStarted) &&
      !isDraftOver.value &&
      autoPickSecondsRemaining.value !== null
  );
  const autoPickCountdownLabel = computed(() => {
    const remaining = autoPickSecondsRemaining.value;
    if (remaining === null) return '--:--';
    return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  });
  watch(autoPickSecondsRemaining, (remaining, previous) => {
    if (
      !arcade() ||
      !showAutoPickCountdown.value ||
      draftState.value?.isLocked ||
      remaining <= 0 ||
      remaining > 10 ||
      previous !== remaining + 1
    )
      return;
    ticks.stop();
    ticks.play(remaining <= 3 ? 'tick2' : 'tick');
  });
  onMounted(() => {
    timer = window.setInterval(() => {
      nowMs.value = Date.now();
    }, 1000);
  });
  onBeforeUnmount(() => {
    window.clearInterval(timer);
  });
  return {
    autoPickSecondsRemaining,
    showAutoPickCountdown,
    autoPickCountdownLabel,
  };
}
