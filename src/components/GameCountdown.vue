<template>
  <div v-if="localTime" class="game-countdown" data-test="game-countdown">
    <strong>{{ countdown }}</strong>
    <time :datetime="startTimeUTC">{{ localTime }}</time>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { formatLocalTime, gameCountdown } from '@/utilities/localTime';
const props = defineProps({ startTimeUTC: String });
const now = ref(Date.now());
const countdown = computed(() => gameCountdown(props.startTimeUTC, now.value));
const localTime = computed(() => {
  // Re-evaluate the device timezone while the page is open as well.
  void now.value;
  return formatLocalTime(props.startTimeUTC);
});
let interval;
onMounted(() => {
  interval = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onBeforeUnmount(() => clearInterval(interval));
</script>

<style scoped>
.game-countdown {
  display: grid;
  gap: 6px;
  text-align: center;
}
strong {
  font-variant-numeric: tabular-nums;
}
time {
  font-size: 0.85em;
  opacity: 0.85;
}
</style>
