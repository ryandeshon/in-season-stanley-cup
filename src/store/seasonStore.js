import { defineStore } from 'pinia';

export const useSeasonStore = defineStore('season', {
  state: () => ({
    currentSeason: 'season2', // Default to Season 2 (current season)
  }),
  getters: {
    playersTableName: (state) => {
      return state.currentSeason === 'season1' ? 'Players-Season1' : 'Players';
    },
    gameRecordsTableName: (state) => {
      return state.currentSeason === 'season1'
        ? 'GameRecords-Season1'
        : 'GameRecords';
    },
    playerImagesPath: (state) => {
      return state.currentSeason === 'season1' ? 'season1' : 'season2';
    },
    seasonDisplayName: (state) => {
      return state.currentSeason === 'season1' ? 'Season 1' : 'Season 2';
    },
  },
  actions: {
    setSeason(season) {
      this.currentSeason = season;
      // Persist to localStorage
      localStorage.setItem('selectedSeason', season);
    },
    loadSeasonFromStorage() {
      const stored = localStorage.getItem('selectedSeason');
      if (stored && (stored === 'season1' || stored === 'season2')) {
        this.currentSeason = stored;
      }
    },
  },
});
