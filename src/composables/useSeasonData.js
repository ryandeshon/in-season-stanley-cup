import { ref, watch, onMounted } from 'vue';
import { useSeasonStore } from '@/store/seasonStore';
import { getAllPlayers, getGameRecords } from '@/services/dynamodbService';

export function useSeasonData() {
  const seasonStore = useSeasonStore();
  const players = ref([]);
  const gameRecords = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Function to fetch all data for current season
  const fetchSeasonData = async () => {
    loading.value = true;
    error.value = null;

    try {
      console.log(`Fetching data for ${seasonStore.seasonDisplayName}...`);
      console.log(`Players table: ${seasonStore.playersTableName}`);
      console.log(`Game records table: ${seasonStore.gameRecordsTableName}`);

      const [playersData, gameRecordsData] = await Promise.all([
        getAllPlayers(),
        getGameRecords(),
      ]);

      players.value = playersData;
      gameRecords.value = gameRecordsData;

      console.log(
        `Loaded ${playersData.length} players and ${gameRecordsData.length} game records`
      );
    } catch (err) {
      console.error('Error fetching season data:', err);
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  // Function to fetch only players data
  const fetchPlayers = async () => {
    loading.value = true;
    error.value = null;

    try {
      console.log(`Fetching players from ${seasonStore.playersTableName}...`);
      const playersData = await getAllPlayers();
      players.value = playersData;
      console.log(`Loaded ${playersData.length} players`);
    } catch (err) {
      console.error('Error fetching players:', err);
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  // Function to fetch only game records data
  const fetchGameRecords = async () => {
    loading.value = true;
    error.value = null;

    try {
      console.log(
        `Fetching game records from ${seasonStore.gameRecordsTableName}...`
      );
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
      fetchSeasonData();
    }
  );

  // Initial data fetch on mount
  onMounted(() => {
    seasonStore.loadSeasonFromStorage();
    fetchSeasonData();
  });

  return {
    players,
    gameRecords,
    loading,
    error,
    fetchSeasonData,
    fetchPlayers,
    fetchGameRecords,
    currentSeason: seasonStore.currentSeason,
    seasonDisplayName: seasonStore.seasonDisplayName,
  };
}
