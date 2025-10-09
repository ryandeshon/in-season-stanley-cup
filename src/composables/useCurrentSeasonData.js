import { ref, onMounted } from 'vue';
import dynamodb from '@/dynamodb-client';

export function useCurrentSeasonData() {
  const players = ref([]);
  const gameRecords = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Function to fetch current season data (always Season 2 tables)
  const fetchCurrentSeasonData = async () => {
    loading.value = true;
    error.value = null;

    try {
      console.log('Fetching current season data (Season 2)...');
      console.log('Players table: Players');
      console.log('Game records table: GameRecords');

      const [playersData, gameRecordsData] = await Promise.all([
        fetchFromTable('Players'),
        fetchFromTable('GameRecords'),
      ]);

      players.value = playersData;
      gameRecords.value = gameRecordsData;

      console.log(
        `Loaded ${playersData.length} players and ${gameRecordsData.length} game records from current season`
      );
    } catch (err) {
      console.error('Error fetching current season data:', err);
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  // Helper function to fetch directly from specified table
  const fetchFromTable = async (tableName) => {
    const params = {
      TableName: tableName,
    };

    const data = await dynamodb.scan(params).promise();
    return data.Items;
  };

  // Initial data fetch on mount
  onMounted(() => {
    fetchCurrentSeasonData();
  });

  return {
    players,
    gameRecords,
    loading,
    error,
    fetchCurrentSeasonData,
  };
}
