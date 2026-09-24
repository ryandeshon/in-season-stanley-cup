<template>
  <section class="stone-frame coronation" data-test="arcade-coronation">
    <p class="eyebrow">{{ season.replace('season', 'SEASON ') }} · COMPLETE</p>
    <img
      v-if="characters[player.name]"
      :src="characters[player.name].portrait"
      :alt="player.name"
    />
    <h2>{{ player.name }}</h2>
    <p class="eyebrow">SEASON CHAMPION</p>
    <p>The season is complete. The record stands.</p>
    <div class="coronation-links">
      <router-link class="arcade-button" to="/standings"
        >View the final standings</router-link
      ><router-link class="arcade-button secondary" to="/story"
        >Watch the story</router-link
      >
    </div>
  </section>
</template>
<script setup>
import { characters } from '@/utilities/arcadeAssets';
defineProps({
  player: { type: Object, required: true },
  season: { type: String, required: true },
});
</script>
<style scoped>
.coronation {
  text-align: center;
  background: #161d15;
  padding: 32px 20px;
}
.coronation img {
  width: 240px;
  max-width: 80%;
  margin: 12px auto 28px;
  border: 3px solid #bfa05a;
}
.coronation h2 {
  font-size: 28px;
}
.coronation-links {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
