<template>
  <span
    class="portrait-visual"
    :class="{ flipped }"
    role="img"
    :aria-label="`${name}: ${emotion}`"
    :data-emotion="emotion"
    :data-art="loaded ? 'expressions' : 'fallback'"
  >
    <span
      v-if="loaded"
      class="expression-tile"
      :style="{
        backgroundImage: `url(${sheet})`,
        backgroundPosition: position,
      }"
    />
    <img v-else :src="fallback" alt="" @error="emit('unavailable')" />
    <img
      v-if="sheet && !failed"
      class="atlas-loader"
      :src="sheet"
      alt=""
      aria-hidden="true"
      @load="loaded = true"
      @error="
        failed = true;
        loaded = false;
      "
    />
  </span>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { expressionAtlases, characters } from '@/utilities/arcadeAssets';
const props = defineProps({
  name: String,
  emotion: { type: String, default: 'Happy' },
  flipped: Boolean,
});
const emit = defineEmits(['unavailable']);
const loaded = ref(false),
  failed = ref(false);
const sheet = computed(() => expressionAtlases[props.name]);
const fallback = computed(() => characters[props.name]?.portrait);
const position = computed(
  () =>
    ({
      Happy: '0% 0%',
      Angry: '100% 0%',
      Anguish: '0% 100%',
      Sad: '100% 100%',
    })[props.emotion] || '0% 0%'
);
watch(sheet, () => {
  loaded.value = false;
  failed.value = false;
});
</script>
<style scoped>
.portrait-visual {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.expression-tile {
  display: block;
  width: 100%;
  height: 100%;
  background-size: 200% 200%;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}
.portrait-visual > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.portrait-visual > .atlas-loader {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
