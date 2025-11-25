// src/composables/useCurrentSeasonData.js
import { ref, onMounted } from 'vue';

// using the same env var you used elsewhere
const API_BASE = process.env.VUE_APP_API_BASE;

export function useCurrentSeasonData() {
  const players = ref([]);
  const gameRecords = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const fetchCurrentSeasonData = async () => {
    loading.value = true;
    error.value = null;

    try {
      const [playersData, gameRecordsData] = await Promise.all([
        fetch(`${API_BASE}/players`).then((r) => {
          if (!r.ok) throw new Error('Failed to fetch players');
          return r.json();
        }),
        fetch(`${API_BASE}/game-records`).then((r) => {
          if (!r.ok) throw new Error('Failed to fetch game records');
          return r.json();
        }),
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

  return {
    players,
    gameRecords,
    loading,
    error,
    fetchCurrentSeasonData,
  };
}
