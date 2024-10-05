<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Welcome to the In Season Stanley Cup</h1>
    <p>Track the champion and standings of the NHL teams as they compete for the cup.</p>
    <p>Is The Champ Playing today? <strong>{{ isGameToday }}</strong></p>
    <pre class="text-left text-sm">
      {{ todaysGames }}
    </pre>
  </v-container>
</template>

<script>
import nhlApi from '../services/nhlApi';

export default {
  name: 'HomePage',
  data() {
    return {
      currentChampion: 'NJD',
      todaysGames: [],
      isGameToday: false,
      gameID: null,
    };
  },
  async created() {
    try {
      const response = await nhlApi.getSchedule();
      this.todaysGames = response.data.gameWeek[0]?.games;
      console.log("🚀 ~ created ~ this.todaysGames:", this.todaysGames)
      
      this.todaysGames.forEach(game => {
        const isChampionPlaying = game.homeTeam.abbrev === this.currentChampion || game.awayTeam.abbrev === this.currentChampion;
        if (isChampionPlaying) {
          this.isGameToday = true;
          this.gameID = game.id;
        }
      });
    } catch (error) {
      console.error('Error fetching getSchedule:', error);
    }
  },
};
</script>
