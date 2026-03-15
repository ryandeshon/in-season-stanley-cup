// src/composables/useCurrentSeasonData.js
import { ref, onMounted, watch } from 'vue';
import { getAllPlayers, getGameRecords } from '@/services/dynamodbService';
import { useSeasonStore } from '@/store/seasonStore';

// using the same env var you used elsewhere
const API_BASE = process.env.VUE_APP_API_BASE;

export function useCurrentSeasonData() {
  const seasonStore = useSeasonStore();
  const players = ref([]);
  const gameRecords = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const fetchCurrentSeasonData = async () => {
    loading.value = true;
    error.value = null;

    try {
      const [playersData, gameRecordsData] = await Promise.all([
        getAllPlayers({ season: seasonStore.currentSeason }),
        getGameRecords({ season: seasonStore.currentSeason }),
      ]);

      players.value = playersData || [];
      gameRecords.value = gameRecordsData || [];
    } catch (err) {
      console.error('Error fetching current season data:', err);
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    if (!API_BASE) {
      console.warn(
        '[useCurrentSeasonData] VUE_APP_API_BASE is not set. Set it in .env.local.'
      );
      return;
    }
    fetchCurrentSeasonData();
  });

  watch(
    () => seasonStore.currentSeason,
    () => {
      if (API_BASE) {
        fetchCurrentSeasonData();
      }
    }
  );

  return {
    players,
    gameRecords,
    loading,
    error,
    fetchCurrentSeasonData,
  };
}
