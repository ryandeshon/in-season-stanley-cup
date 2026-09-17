import { computed, onMounted } from 'vue';
import { useSeasonStore } from '@/store/seasonStore';
import { getAllPlayers, getGameRecords } from '@/services/dynamodbService';
import { useSeasonResources } from './useSeasonResources';

export function useSeasonData(options = {}) {
  const seasonStore = useSeasonStore();
  onMounted(() => seasonStore.loadSeasonFromStorage());
  const resources = useSeasonResources(
    () => seasonStore.currentSeason,
    {
      players: (season) => getAllPlayers({ season }),
      gameRecords: (season) => getGameRecords({ season }),
    },
    { players: () => [], gameRecords: () => [] },
    options
  );
  return {
    ...resources,
    fetchSeasonData: () => resources.refresh(),
    fetchPlayers: () => resources.refresh(['players']),
    fetchGameRecords: () => resources.refresh(['gameRecords']),
    currentSeason: computed(() => seasonStore.currentSeason),
    seasonDisplayName: computed(() => seasonStore.seasonDisplayName),
  };
}
