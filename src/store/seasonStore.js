import { defineStore } from 'pinia';
import { apiRequest } from '@/services/apiClient';
const legacySeasons = [
  { id: 'season1', label: 'Season 1', status: 'archived' },
  { id: 'season2', label: 'Season 2', status: 'active' },
];
export const useSeasonStore = defineStore('season', {
  state: () => ({
    currentSeason: 'season2',
    seasons: [...legacySeasons],
    catalogError: null,
    storageVersion: 'legacy',
  }),
  getters: {
    selectedSeason: (s) =>
      s.seasons.find((season) => season.id === s.currentSeason),
    canDraft: (s) =>
      s.storageVersion === 'legacy'
        ? s.currentSeason === 'season2' &&
          s.seasons.find((season) => season.id === s.currentSeason)?.status !==
            'archived'
        : s.seasons.some(
            (season) =>
              season.id === s.currentSeason &&
              season.status === 'preseason' &&
              season.writersEnabled
          ),
    playersTableName: (s) =>
      s.currentSeason === 'season2'
        ? 'Players'
        : `Players-Season${s.currentSeason.slice(6)}`,
    gameRecordsTableName: (s) =>
      s.currentSeason === 'season2'
        ? 'GameRecords'
        : `GameRecords-Season${s.currentSeason.slice(6)}`,
    playerImagesPath: (s) =>
      s.currentSeason === 'season1' ? 'season1' : 'season2',
    seasonDisplayName: (s) =>
      s.seasons.find((season) => season.id === s.currentSeason)?.label ||
      s.currentSeason,
  },
  actions: {
    setSeason(season) {
      if (!this.seasons.some((s) => s.id === season)) return;
      this.currentSeason = season;
      localStorage.setItem('selectedSeason', season);
    },
    loadSeasonFromStorage() {
      const stored = localStorage.getItem('selectedSeason');
      if (this.seasons.some((s) => s.id === stored))
        this.currentSeason = stored;
    },
    async loadCatalog() {
      try {
        const catalog = await apiRequest('/seasons', { cache: 'no-store' });
        if (
          !Array.isArray(catalog.seasons) ||
          !catalog.seasons.some((s) => s.id === catalog.defaultSeason) ||
          new Set(catalog.seasons.map((s) => s.id)).size !==
            catalog.seasons.length
        )
          throw new Error('Invalid season catalog');
        this.seasons = catalog.seasons;
        this.storageVersion = catalog.storageVersion || 'legacy';
        this.currentSeason = catalog.defaultSeason;
        this.catalogError = null;
      } catch (error) {
        // Compatibility only for the old API lacking the catalog route.
        if (error.status !== 404) {
          this.catalogError =
            'Season data is unavailable. Please reload to try again.';
          return;
        }
      }
      this.loadSeasonFromStorage();
    },
  },
});
