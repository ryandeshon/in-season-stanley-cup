import { computed, onMounted, unref } from 'vue';
import { useSeasonStore } from '@/store/seasonStore';
import {
  getAllPlayers,
  getGameRecords,
  getPlayerData,
} from '@/services/dynamodbService';
import { useSeasonResources } from './useSeasonResources';

export function usePlayerSeasonData(playerName) {
  const seasonStore = useSeasonStore();
  onMounted(() => seasonStore.loadSeasonFromStorage());
  const resources = useSeasonResources(
    () => [seasonStore.currentSeason, String(unref(playerName) || '').trim()],
    {
      players: ([season]) => getAllPlayers({ season }),
      gameRecords: ([season]) => getGameRecords({ season }),
      player: ([season, name]) =>
        name ? getPlayerData(name, { season }) : null,
    },
    { players: () => [], gameRecords: () => [], player: () => null }
  );
  return {
    ...resources,
    fetchSeasonData: () => resources.refresh(),
    fetchPlayers: () => resources.refresh(['players']),
    fetchGameRecords: () => resources.refresh(['gameRecords']),
    fetchPlayerData: () => resources.refresh(['player']),
    currentSeason: computed(() => seasonStore.currentSeason),
    seasonDisplayName: computed(() => seasonStore.seasonDisplayName),
  };
}
