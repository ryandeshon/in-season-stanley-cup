<template>
  <v-container class="min-h-32 px-0">
    <SeasonChampionFlash
      :player="mockPlayer"
      :champion-image-src="championImage"
      quote="Suck it nerds"
    />
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import SeasonChampionFlash from '@/components/SeasonChampionFlash.vue';
import ryanWinnerImage from '@/assets/players/season2/ryan-winner.webp';

const mockPlayer = ref({
  name: 'Ryan',
  teams: ['VGK', 'TOR', 'BOS', 'DAL'],
  titleDefenses: 15,
});

const championImage = ref(ryanWinnerImage);
</script>
