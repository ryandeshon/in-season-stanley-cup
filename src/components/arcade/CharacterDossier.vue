<template>
  <section class="character-dossier" data-test="character-dossier">
    <button
      type="button"
      class="dossier-card"
      :style="{ '--character-color': character.color }"
      :aria-label="`${player.name} character dossier. ${emotion} portrait, ${index + 1} of 4. Show next expression.`"
      :aria-describedby="`dossier-details-${player.name}`"
      @click="index = (index + 1) % emotions.length"
    >
      <span class="dossier-portrait-column">
        <span class="dossier-portrait">
          <ExpressivePortrait :name="player.name" :emotion="emotion" />
        </span>
        <span class="dossier-expression" aria-live="polite"
          >{{ emotion }} · {{ index + 1 }} / 4</span
        >
        <span class="dossier-dots" aria-hidden="true">
          <i
            v-for="(_, n) in emotions"
            :key="n"
            :class="{ active: n === index }"
          />
        </span>
      </span>
      <span class="dossier-copy" :id="`dossier-details-${player.name}`">
        <span class="dossier-eyebrow">CHARACTER DOSSIER</span>
        <span class="dossier-name">{{ player.name }}</span>
        <span class="dossier-title">{{ character.title }}</span>
        <span class="dossier-lore">{{ character.lore }}</span>
        <span
          v-if="trophyCount"
          class="dossier-honors"
          data-test="championship-honors"
        >
          <img
            v-for="n in trophyCount"
            :key="n"
            :src="cup"
            :alt="
              n === 1 && historicalTitle ? historicalTitle : `Championship ${n}`
            "
          />
          <span>{{
            historicalTitle ||
            `${trophyCount} championship${trophyCount === 1 ? '' : 's'}`
          }}</span>
        </span>
        <span class="dossier-stats">
          <span
            >Title Defenses:
            <strong>{{ player.titleDefenses ?? 0 }}</strong></span
          >
          <span v-if="player.totalDefenses != null"
            >Lifetime Defenses:
            <strong>{{ player.totalDefenses }}</strong></span
          >
        </span>
        <span class="dossier-hint">Click card to change expression ↻</span>
      </span>
    </button>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import ExpressivePortrait from './ExpressivePortrait.vue';
import { characters } from '@/utilities/arcadeAssets';
import cup from '@/assets/arcade/icons/championship-cup.svg';
const props = defineProps({ player: { type: Object, required: true } });
const emotions = ['Happy', 'Angry', 'Anguish', 'Sad'];
const index = ref(0);
const emotion = computed(() => emotions[index.value]);
const character = computed(() => characters[props.player.name] || {});
// User-confirmed historical honors, independent of the selected season's counters.
const historicalTitle = computed(
  () =>
    ({ Cooper: 'Season 1 champion', Ryan: 'Season 2 champion' })[
      props.player.name
    ]
);
const trophyCount = computed(() =>
  Math.max(
    Number.isInteger(props.player.championships) &&
      props.player.championships > 0
      ? props.player.championships
      : 0,
    historicalTitle.value ? 1 : 0
  )
);
watch(
  () => props.player.name,
  () => {
    index.value = 0;
  }
);
</script>
<style scoped>
.character-dossier {
  width: 100%;
}
.dossier-card {
  display: grid;
  grid-template-columns: minmax(0, 230px) minmax(0, 1fr);
  gap: 28px;
  width: 100%;
  padding: 24px;
  text-align: left;
  color: #f4f0df;
  background: linear-gradient(135deg, #23302a, #111916);
  border: 5px ridge #8b917e;
  border-radius: 0;
  cursor: pointer;
}
.dossier-card:hover {
  border-color: #e1c474;
}
.dossier-card:focus-visible {
  outline: 3px solid #a6ed75;
  outline-offset: 4px;
}
.dossier-portrait-column {
  align-self: center;
  min-width: 0;
  text-align: center;
}
.dossier-portrait {
  display: block;
  aspect-ratio: 1;
  border: 3px solid var(--character-color, #ccbb79);
  overflow: hidden;
}
.dossier-expression {
  display: block;
  margin-top: 14px;
  font:
    9px/1.7 'Press Start 2P',
    monospace;
  color: #f1db9d;
}
.dossier-dots {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
}
.dossier-dots i {
  width: 6px;
  height: 6px;
  background: #59695c;
}
.dossier-dots i.active {
  background: #e4c476;
}
.dossier-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dossier-eyebrow {
  font:
    9px/1.7 'Press Start 2P',
    monospace;
  color: #c5cdbb;
}
.dossier-name {
  font:
    24px/1.6 'Press Start 2P',
    monospace;
  text-transform: uppercase;
  margin: 8px 0;
  color: #fff3d0;
}
.dossier-title {
  color: var(--character-color, #ccbb79);
  font-size: 15px;
  font-weight: bold;
}
.dossier-lore {
  display: block;
  font:
    14px/1.8 Arial,
    sans-serif;
  margin: 12px 0;
  color: #e4e9df;
}
.dossier-honors {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  color: #efd793;
  font-size: 12px;
}
.dossier-honors img {
  width: 40px;
  height: 48px;
  object-fit: contain;
}
.dossier-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  border-top: 1px solid #485747;
  padding-top: 12px;
  font:
    12px/1.7 Arial,
    sans-serif;
  color: #e3e8dc;
}
.dossier-stats strong {
  color: #fff;
}
.dossier-hint {
  font:
    11px/1.5 Arial,
    sans-serif;
  color: #c4cfba;
  margin-top: 15px;
}
@media (max-width: 600px) {
  .dossier-card {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 18px;
  }
  .dossier-portrait-column {
    width: 100%;
    max-width: 230px;
    justify-self: center;
  }
  .dossier-name {
    font-size: 22px;
  }
}
</style>
