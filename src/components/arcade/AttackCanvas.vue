<template>
  <div
    ref="host"
    class="attack-canvas"
    aria-hidden="true"
    :data-renderer="ready ? 'pixi' : 'fallback'"
  />
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
const props = defineProps({
  enabled: Boolean,
  phase: String,
  attack: String,
  side: String,
});
const emit = defineEmits(['ready']);
const host = ref(null);
const ready = ref(false);
let renderer;
let generation = 0;
function dispose() {
  generation++;
  renderer?.destroy();
  renderer = null;
  ready.value = false;
  emit('ready', false);
}
watch(
  [host, () => props.enabled],
  async () => {
    dispose();
    if (!host.value || !props.enabled) return;
    const ticket = generation;
    try {
      const { createAttackRenderer } = await import(
        /* webpackChunkName: "arcade-attacks" */ '@/utilities/attackRenderer'
      );
      if (ticket !== generation) return;
      const instance = await createAttackRenderer(host.value);
      if (ticket !== generation) {
        instance.destroy();
        return;
      }
      renderer = instance;
      ready.value = true;
      emit('ready', true);
      // Do not replay an event that happened while the renderer was loading.
    } catch {
      // Graphics are optional: the score and static impact remain usable.
      if (ticket === generation) dispose();
    }
  },
  { flush: 'post' }
);
watch(
  () => [props.phase, props.attack, props.side],
  () => {
    renderer?.setPhase(props.phase, props.attack, props.side);
  }
);
onBeforeUnmount(dispose);
</script>
<style scoped>
.attack-canvas {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;
}
.attack-canvas :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
