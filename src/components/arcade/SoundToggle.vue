<template>
  <button
    class="quiet-control sound-toggle"
    :aria-pressed="soundEnabled"
    :aria-label="soundEnabled ? 'Mute sound' : 'Enable sound'"
    :title="soundEnabled ? 'Mute sound' : 'Enable sound'"
    @click="toggle"
  >
    <v-icon aria-hidden="true">{{
      soundEnabled ? 'mdi-volume-high' : 'mdi-volume-off'
    }}</v-icon>
  </button>
</template>
<script setup>
import { soundEnabled, unlockArcadeSound } from '@/composables/useArcadeSound';
function toggle() {
  soundEnabled.value = !soundEnabled.value;
  if (soundEnabled.value) unlockArcadeSound();
}
</script>
<style scoped>
.sound-toggle {
  min-width: 44px;
  min-height: 44px;
}
</style>
