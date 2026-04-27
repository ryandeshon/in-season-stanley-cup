<template>
  <div>
    <template v-if="loading">
      <div class="flex justify-center items-center mt-10">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>
    </template>
    <v-alert v-else-if="!player" type="warning" variant="tonal">
      Season champion is not available yet.
    </v-alert>
    <SeasonChampionFlash
      v-else
      :player="player"
      :champion-image-src="championImageSrc"
      quote="Suck It Nerds"
      @image-error="handleChampionImageError"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { getAllPlayers } from '@/services/dynamodbService';
import { getCurrentChampion } from '@/services/championServices';
import { useSeasonStore } from '@/store/seasonStore';
import { selectSeasonChampion } from '@/utilities/seasonChampion';
import { getPlayerImageUrl } from '@/utilities/assetUrls';

import SeasonChampionFlash from '@/components/SeasonChampionFlash.vue';
import season1CooperChampionImage from '@/assets/players/season1/season-champion.png';
import season2BozChampionImage from '@/assets/players/season2/boz-winner.png';
import season2RyanChampionImage from '@/assets/players/season2/ryan-winner.webp';
import season2BozHappyImage from '@/assets/players/season2/boz-happy.png';
import season2CooperHappyImage from '@/assets/players/season2/cooper-happy.png';
import season2RyanHappyImage from '@/assets/players/season2/ryan-happy.png';
import season2TerryHappyImage from '@/assets/players/season2/terry-happy.png';

const seasonStore = useSeasonStore();
const player = ref(null);
const loading = ref(true);
const useLocalImageFallback = ref(false);

const seasonKey = computed(() =>
  seasonStore.currentSeason === 'season1' ? 'season1' : 'season2'
);

const winnerImages = {
  season1: {
    Cooper: season1CooperChampionImage,
  },
  season2: {
    Boz: season2BozChampionImage,
    Ryan: season2RyanChampionImage,
  },
};

const fallbackImages = {
  season1: {
    Cooper: season1CooperChampionImage,
  },
  season2: {
    Boz: season2BozHappyImage,
    Cooper: season2CooperHappyImage,
    Ryan: season2RyanHappyImage,
    Terry: season2TerryHappyImage,
  },
};

const localWinnerImage = computed(() => {
  const playerName = player.value?.name;
  if (!playerName) return null;
  return winnerImages[seasonKey.value]?.[playerName] || null;
});

const localFallbackImage = computed(() => {
  const playerName = player.value?.name;
  if (!playerName) return null;
  return fallbackImages[seasonKey.value]?.[playerName] || null;
});

const hasWinnerArtForPlayer = computed(() => Boolean(localWinnerImage.value));

const remoteWinnerImage = computed(() => {
  if (!hasWinnerArtForPlayer.value) return null;
  return getPlayerImageUrl(seasonKey.value, player.value?.name, 'Winner');
});

const championImageSrc = computed(() => {
  if (!useLocalImageFallback.value && remoteWinnerImage.value) {
    return remoteWinnerImage.value;
  }
  return localWinnerImage.value || localFallbackImage.value;
});

function handleChampionImageError() {
  if (remoteWinnerImage.value && !useLocalImageFallback.value) {
    useLocalImageFallback.value = true;
  }
}

async function loadSeasonChampion() {
  loading.value = true;
  try {
    const season = seasonKey.value;
    const [players, currentChampionTeam] = await Promise.all([
      getAllPlayers({ season }),
      getCurrentChampion({ season }),
    ]);
    player.value = selectSeasonChampion(players, currentChampionTeam);
  } catch (error) {
    player.value = null;
    console.error('Error fetching season champion data:', error);
  } finally {
    loading.value = false;
  }
}

watch(
  () => seasonStore.currentSeason,
  () => {
    loadSeasonChampion();
  }
);

watch(
  () => [seasonStore.currentSeason, player.value?.name],
  () => {
    useLocalImageFallback.value = false;
  }
);

onMounted(async () => {
  seasonStore.loadSeasonFromStorage();
  await loadSeasonChampion();
});
</script>
