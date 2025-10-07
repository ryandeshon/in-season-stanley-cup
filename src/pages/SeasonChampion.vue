<template>
  <v-container class="max-w-screen-md min-h-32">
    <template v-if="!player">
      <div class="flex justify-center items-center mt-10">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>
    </template>
    <div v-else class="flex flex-col items-center">
      <div class="text-4xl font-bold uppercase animated-name">
        <span
          v-for="(letter, index) in player.name.split('')"
          :key="index"
          class="letter"
          :style="{ animationDelay: `${index * 0.2}s` }"
        >
          {{ letter }}
        </span>
      </div>
      <img
        :src="cooperChampionImageRef"
        alt="Cooper Champion"
        class="w-full mb-4"
      />
      <p class="text-2xl font-bold mb-4 text-center">
        "We're not going to be fucking suck this year!" —Ovechkin
      </p>
      <div class="grid gap-2 grid-cols-4 md:grid-cols-8">
        <div v-for="team in player.teams" :key="team">
          <TeamLogo :team="team" width="50" height="50" />
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { getPlayerData } from '../services/dynamodbService';
import { useTheme } from 'vuetify';

import cooperChampionImage from '@/assets/players/season1/season-champion.png';
import TeamLogo from '@/components/TeamLogo.vue';

const theme = useTheme();
const isDarkOrLight = ref(theme.global.name.value);

watch(
  () => theme.global.name.value,
  (newVal) => {
    isDarkOrLight.value = newVal;
  },
  { immediate: true }
);

const player = ref(null);
const cooperChampionImageRef = ref(cooperChampionImage);

onMounted(async () => {
  try {
    player.value = await getPlayerData('Cooper');
  } catch (error) {
    console.error('Error fetching player data:', error);
  }
});
</script>

<style scoped>
.animated-name {
  font-family: var(--font-heading);
}
.animated-name .letter {
  display: inline-block;
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 0.5s forwards;
}

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
