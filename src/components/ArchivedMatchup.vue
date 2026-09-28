<template>
  <section data-test="archived-matchup" aria-label="Final cup matchup">
    <p v-if="loading" role="status" class="text-center my-6">
      Loading final matchup…
    </p>
    <v-alert v-else-if="error" type="warning" variant="tonal">
      The archived matchup could not be loaded. Please reload to try again.
    </v-alert>
    <template v-else-if="game">
      <h2 class="text-center text-xl font-bold mt-4">Final cup matchup</h2>
      <p class="text-center mb-4">{{ seasonLabel }} · Final</p>
      <div class="archive-faceoff">
        <div data-test="archive-winner">
          <PlayerCard
            :player="owner(game.wTeam)"
            :team="team(game.wTeam)"
            image-type="Happy"
          />
          <p class="text-center font-bold text-2xl mt-3">{{ game.wScore }}</p>
        </div>
        <strong class="archive-vs">VS</strong>
        <div data-test="archive-loser">
          <PlayerCard
            :player="owner(game.lTeam)"
            :team="team(game.lTeam)"
            image-type="Sad"
          />
          <p class="text-center font-bold text-2xl mt-3">{{ game.lScore }}</p>
        </div>
      </div>
      <p class="text-center mt-4">
        <router-link :to="`/game/${game.id}`" data-test="archive-game-details"
          >Game details</router-link
        >
      </p>
    </template>
    <p v-else class="text-center my-6" data-test="archive-no-games">
      No cup matchups were recorded for this season.
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import PlayerCard from '@/components/PlayerCard.vue';
import { sortGamesByRecency } from '@/utilities/playerProfileTrends';
const props = defineProps({
  records: { type: Array, default: () => [] },
  players: { type: Array, default: () => [] },
  seasonLabel: { type: String, default: '' },
  loading: Boolean,
  error: { default: null },
});
const game = computed(() => sortGamesByRecency(props.records)[0] || null);
function owner(abbrev) {
  return (
    props.players.find((player) => player.teams?.includes(abbrev)) || {
      name: 'Unknown',
    }
  );
}
function team(abbrev) {
  return { abbrev, placeName: { default: abbrev } };
}
</script>

<style scoped>
.archive-faceoff {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}
.archive-faceoff > div {
  min-width: 0;
}
.archive-faceoff :deep(.avatar) {
  width: 100%;
  max-width: 208px;
}
.archive-vs {
  font-size: 1.25rem;
}
</style>
