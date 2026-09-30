<template>
  <button
    class="quiet-control sound-toggle"
    :aria-pressed="soundEnabled && audioReady"
    :aria-label="soundEnabled && audioReady ? 'Mute sound' : 'Enable sound'"
    :title="soundEnabled && audioReady ? 'Mute sound' : 'Enable sound'"
    @pointerdown.stop
    @keydown.stop
    @click="toggle"
  >
    <v-icon aria-hidden="true">{{
      soundEnabled && audioReady ? 'mdi-volume-high' : 'mdi-volume-off'
    }}</v-icon>
  </button>
</template>
<script setup>
import {
  soundEnabled,
  audioReady,
  unlockArcadeSound,
} from '@/composables/useArcadeSound';
function toggle() {
  soundEnabled.value = !soundEnabled.value || !audioReady.value;
  if (soundEnabled.value) unlockArcadeSound();
}
</script>
<style scoped>
.sound-toggle {
  min-width: 44px;
  min-height: 44px;
}
</style>
