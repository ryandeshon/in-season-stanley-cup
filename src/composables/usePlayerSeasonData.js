import { ref, watch, onMounted } from 'vue';
import { useSeasonStore } from '@/store/seasonStore';
import { getGameRecords, getPlayerData } from '@/services/dynamodbService';

export function usePlayerSeasonData(playerName) {
  const seasonStore = useSeasonStore();
  const gameRecords = ref([]);
  const player = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // Function to fetch game records for current season
  const fetchGameRecords = async () => {
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
    (newSeason, oldSeason) => {
      console.log(`Season changed from ${oldSeason} to: ${newSeason}`);
      console.log('Fetching new game records...');
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
