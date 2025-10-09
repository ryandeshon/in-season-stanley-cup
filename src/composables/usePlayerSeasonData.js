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
    }
  };

  // Function to fetch player data for current season
  const fetchPlayerData = async () => {
    if (!playerName) return;

    try {
      console.log(
        `Fetching player data for ${playerName} in ${seasonStore.seasonDisplayName}...`
      );
      console.log(`Players table: ${seasonStore.playersTableName}`);

      const playerData = await getPlayerData(playerName);
      player.value = playerData;

      console.log(`Loaded player data for ${playerName}:`, playerData);
    } catch (err) {
      console.error('Error fetching player data:', err);
      error.value = err;
    }
  };

  // Function to fetch all season data
  const fetchSeasonData = async () => {
    loading.value = true;
    error.value = null;

    try {
      await Promise.all([fetchPlayerData(), fetchGameRecords()]);
    } finally {
      loading.value = false;
    }
  };

  // Watch for season changes and refetch data
  watch(
    () => seasonStore.currentSeason,
    (newSeason, oldSeason) => {
      console.log(`Season changed from ${oldSeason} to: ${newSeason}`);
      console.log('Fetching new player and game data...');
      fetchSeasonData();
    }
  );

  // Initial data fetch on mount
  onMounted(() => {
    seasonStore.loadSeasonFromStorage();
    fetchSeasonData();
  });

  return {
    gameRecords,
    player,
    loading,
    error,
    fetchGameRecords,
    fetchPlayerData,
    fetchSeasonData,
    currentSeason: seasonStore.currentSeason,
    seasonDisplayName: seasonStore.seasonDisplayName,
  };
}
