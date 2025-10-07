import { ref, watch, onMounted } from 'vue';
import { useSeasonStore } from '@/store/seasonStore';
import { getGameRecords } from '@/services/dynamodbService';

export function usePlayerSeasonData() {
  const seasonStore = useSeasonStore();
  const gameRecords = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Function to fetch game records for current season
  const fetchGameRecords = async () => {
    loading.value = true;
    error.value = null;

    try {
      console.log(
        `Fetching game records for ${seasonStore.seasonDisplayName}...`
      );
      console.log(`Game records table: ${seasonStore.gameRecordsTableName}`);

      const gameRecordsData = await getGameRecords();
      gameRecords.value = gameRecordsData;

      console.log(`Loaded ${gameRecordsData.length} game records`);
    } catch (err) {
      console.error('Error fetching game records:', err);
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  // Watch for season changes and refetch data
  watch(
    () => seasonStore.currentSeason,
    () => {
      console.log(`Season changed to: ${seasonStore.currentSeason}`);
      fetchGameRecords();
    }
  );

  // Initial data fetch on mount
  onMounted(() => {
    seasonStore.loadSeasonFromStorage();
    fetchGameRecords();
  });

  return {
    gameRecords,
    loading,
    error,
    fetchGameRecords,
    currentSeason: seasonStore.currentSeason,
    seasonDisplayName: seasonStore.seasonDisplayName,
  };
}
