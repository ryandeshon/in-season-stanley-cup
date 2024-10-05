<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Welcome to the In Season Stanley Cup</h1>
    <p>Track the champion and standings of the NHL teams as they compete for the cup.</p>
    <p>Is The Champ Playing today? <strong>{{ isGameToday }}</strong></p>

    <div class="grid grid-cols-3 gap-4 w-full my-4">
      <v-card>
        <v-card-title>Champion</v-card-title>
        <v-card-text>
          <p>{{ playerChampion?.name }}</p>
        </v-card-text>
      </v-card>
      <div><strong>VS</strong></div>
      <v-card>
        <v-card-title>Challenger</v-card-title>
        <v-card-text>
          <p>{{ playerChallenge?.name }}</p>
        </v-card-text>
      </v-card>
    </div>
  </v-container>
</template>

<script>
import nhlApi from '../services/nhlApi';
import { getAllPlayers } from '../services/dynamodbService';

export default {
  name: 'HomePage',
  data() {
    return {
      currentChampion: 'FLA',
      todaysGames: [],
      allPlayersData: null,
      playerChampion: null,
      playerChallenge: null,
      isGameToday: false,
      gameID: null,
    };
  },
  async created() {
    try {
      this.allPlayersData = await getAllPlayers();
      const response = await nhlApi.getSchedule();
      this.todaysGames = response.data.gameWeek[0]?.games;
      
      this.todaysGames.forEach(game => {
        const isChampionPlaying = game.homeTeam.abbrev === this.currentChampion || game.awayTeam.abbrev === this.currentChampion;
        if (isChampionPlaying) {
          this.isGameToday = true;
          this.gameID = game.id;
        }
      });

      // find the player who is the current champion
      this.playerChampion = this.allPlayersData.find(player => player.teams.includes(this.currentChampion));
      // find the player who is challenging the current champion
      this.playerChallenge = this.allPlayersData.find(player => player.teams.includes(this.todaysGames[0].homeTeam.abbrev) || player.teams.includes(this.todaysGames[0].awayTeam.abbrev));
    } catch (error) {
      console.error('Error fetching getSchedule:', error);
    }
  },
};
</script>
