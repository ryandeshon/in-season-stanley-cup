import { ref, watch, onMounted, unref } from 'vue';
import { useSeasonStore } from '@/store/seasonStore';
import {
  getAllPlayers,
  getGameRecords,
  getPlayerData,
} from '@/services/dynamodbService';

export function usePlayerSeasonData(playerName) {
  const seasonStore = useSeasonStore();
  const gameRecords = ref([]);
  const players = ref([]);
  const player = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const resolvedPlayerName = () => String(unref(playerName) || '').trim();

  // Function to fetch game records for current season
  const fetchGameRecords = async () => {
    try {
      console.log(
        `Fetching game records for ${seasonStore.seasonDisplayName}...`
      );
      console.log(`Game records table: ${seasonStore.gameRecordsTableName}`);

      const gameRecordsData = await getGameRecords({
        season: seasonStore.currentSeason,
      });
      gameRecords.value = gameRecordsData;

      console.log(`Loaded ${gameRecordsData.length} game records`);
    } catch (err) {
      console.error('Error fetching game records:', err);
      error.value = err;
    }
  };

  // Function to fetch player data for current season
  const fetchPlayerData = async () => {
    const playerNameValue = resolvedPlayerName();
    if (!playerNameValue) {
      player.value = null;
      return;
    }

    try {
      console.log(
        `Fetching player data for ${playerNameValue} in ${seasonStore.seasonDisplayName}...`
      );
      console.log(`Players table: ${seasonStore.playersTableName}`);

      const playerData = await getPlayerData(playerNameValue, {
        season: seasonStore.currentSeason,
      });
      player.value = playerData;

      console.log(`Loaded player data for ${playerNameValue}:`, playerData);
    } catch (err) {
      console.error('Error fetching player data:', err);
      error.value = err;
    }
  };

  // Function to fetch all players for current season
  const fetchPlayers = async () => {
    try {
      console.log(`Fetching players from ${seasonStore.playersTableName}...`);
      const playersData = await getAllPlayers({
        season: seasonStore.currentSeason,
      });
      players.value = playersData;
      console.log(`Loaded ${playersData.length} players`);
    } catch (err) {
      console.error('Error fetching players:', err);
      error.value = err;
    }
  };

  // Function to fetch all season data
  const fetchSeasonData = async () => {
    loading.value = true;
    error.value = null;

    try {
      await Promise.all([
        fetchPlayerData(),
        fetchGameRecords(),
        fetchPlayers(),
      ]);
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

  watch(
    () => resolvedPlayerName(),
    (newPlayerName, oldPlayerName) => {
      if (newPlayerName === oldPlayerName) return;
      console.log(
        `Player profile changed from ${oldPlayerName || '<none>'} to ${newPlayerName || '<none>'}`
      );
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
    players,
    player,
    loading,
    error,
    fetchGameRecords,
    fetchPlayers,
    fetchPlayerData,
    fetchSeasonData,
    currentSeason: seasonStore.currentSeason,
    seasonDisplayName: seasonStore.seasonDisplayName,
  };
}
