import { defineStore } from 'pinia';
import {
  getFallbackSeasonOptions,
  getSeasonOptions,
} from '@/services/seasonService';

export const useSeasonStore = defineStore('season', {
  state: () => ({
    currentSeason: 'season2',
    seasonOptions: [
      { label: '1', value: 'season1' },
      { label: '2', value: 'season2' },
    ],
    seasonOptionsLoaded: false,
  }),
  getters: {
    playersTableName: () => 'PlayerSeason + PlayerLifetime',
    gameRecordsTableName: () => 'GameRecordsV2',
    playerImagesPath: (state) => {
      return state.currentSeason === 'season1' ? 'season1' : 'season2';
    },
    seasonDisplayName: (state) => {
      const selected = state.seasonOptions.find(
        (option) => option.value === state.currentSeason
      );
      const label = selected?.label || state.currentSeason;
      return `Season ${label}`;
    },
  },
  actions: {
    setSeason(season) {
      this.currentSeason = season;
      localStorage.setItem('selectedSeason', season);
    },
    setSeasonOptions(seasonOptions, defaultSeason) {
      const normalized = Array.isArray(seasonOptions)
        ? seasonOptions.filter(
            (option) => option && option.value && option.label !== undefined
          )
        : [];

      this.seasonOptions =
        normalized.length > 0
          ? normalized
          : [
              { label: '1', value: 'season1' },
              { label: '2', value: 'season2' },
            ];

      const validValues = new Set(
        this.seasonOptions.map((option) => option.value)
      );
      const stored = localStorage.getItem('selectedSeason');

      if (stored && validValues.has(stored)) {
        this.currentSeason = stored;
      } else if (defaultSeason && validValues.has(defaultSeason)) {
        this.currentSeason = defaultSeason;
      } else {
        this.currentSeason = this.seasonOptions[0]?.value || 'season2';
      }

      localStorage.setItem('selectedSeason', this.currentSeason);
      this.seasonOptionsLoaded = true;
    },
    loadSeasonFromStorage() {
      const stored = localStorage.getItem('selectedSeason');
      const validValues = new Set(
        this.seasonOptions.map((option) => option.value)
      );
      if (stored && validValues.has(stored)) {
        this.currentSeason = stored;
      }
    },
    async initializeSeasonOptions() {
      try {
        const payload = await getSeasonOptions();
        const seasonOptions = payload.seasons.map((season) => ({
          label: season.label,
          value: season.id,
        }));
        this.setSeasonOptions(seasonOptions, payload.defaultSeason);
      } catch (error) {
        console.warn(
          '[seasonStore] Failed to load /season/options. Using fallback seasons.',
          error
        );
        const payload = getFallbackSeasonOptions();
        const seasonOptions = payload.seasons.map((season) => ({
          label: season.label,
          value: season.id,
        }));
        this.setSeasonOptions(seasonOptions, payload.defaultSeason);
      }
    },
  },
});
