import { computed, ref, onMounted, onBeforeUnmount } from 'vue';

export function useDraftCountdown(draftState, isDraftOver) {
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
