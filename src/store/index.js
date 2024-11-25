import { createPinia, defineStore } from 'pinia';

export const useCupStore = defineStore('cup', {
  state: () => ({
    cupHolder: null,
    standings: [],
    users: [], // Players in the game and their teams
  }),
  actions: {
    setCupHolder(team) {
      this.cupHolder = team;
    },
    updateStandings(user, daysHeld) {
      const player = this.standings.find((p) => p.user === user);
      if (player) {
        player.daysHeld += daysHeld;
      } else {
        this.standings.push({ user, daysHeld });
      }
    },
  },
});

// In your main.js file, add the Pinia store:
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createGtag } from 'vue-gtag-next';

const app = createApp(App);

// Set up Google Analytics with vue-gtag
app.use(
  createGtag,
  {
    property: {
      id: 'G-KPL5ZVDJC7', // Replace with your actual Measurement ID
    },
  },
  router // Optional: pass router to track page views automatically
);

app.use(createPinia());
app.use(router);
app.mount('#app');
