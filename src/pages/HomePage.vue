<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Welcome to the In Season Stanley Cup</h1>
    <p>Track the champion and standings of the NHL teams as they compete for the cup.</p>

    <template v-if="loading">
      <div class="flex justify-center items-center mt-10">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </template>

    <template v-else>
      <template v-if="isGameOver">
        <div class="flex flex-col justify-center align-center my-4">
          <h2 class="text-2xl font-bold mb-4">Game Over</h2>
          <p>Final Score: {{ playerChampion.team.score }} - {{ playerChallenger.team.score }}</p>
          <p>Winner: <strong>{{ todaysWinner.name }}</strong></p>
          <img :src="todaysWinner?.team?.logo" class="w-28 mt-4" alt="Winner Team Logo" />
        </div>
      </template>

      <template v-else-if="todaysGame">
        <div class="grid grid-cols-3 gap-4 w-full my-4">
          <v-card>
            <v-card-title>Champion</v-card-title>
            <v-card-text>
              <p>{{ playerChampion?.name }}</p>
              <p>{{ playerChampion?.team?.placeName.default }}</p>
              <img :src="playerChampion?.team?.logo" alt="Challenger Team Logo" />
            </v-card-text>
          </v-card>
          <div class="flex justify-center items-center"><strong>VS</strong></div>
          <v-card>
            <v-card-title>Challenger</v-card-title>
            <v-card-text>
              <p>{{ playerChallenger?.name }}</p>
              <p>{{ playerChallenger?.team?.placeName.default }}</p>
              <img :src="playerChallenger?.team?.logo" alt="Challenger Team Logo" />
            </v-card-text>
          </v-card>
        </div>
      </template>

      <template v-else>
        <p>No games today.</p>
      </template>
    </template>
  </v-container>
</template>

<script>
import nhlApi from '../services/nhlApi';
import { getAllPlayers } from '../services/dynamodbService';
import { getCurrentChampion, getGameId } from '../services/championServices';
import { DateTime } from 'luxon';

export default {
  name: 'HomePage',
  data() {
    return {
      loading: true,
      currentChampion: null, // Set the current champion team abbreviation
      todaysDate: DateTime.now().toFormat('yyyy-MM-dd'),
      todaysGame: null,
      todaysWinner: {},
      allPlayersData: null,
      playerChampion: {},
      playerChallenger: {},
      isGameToday: false,
      isGameOver: false,
      gameID: null,
    };
  },
  async created() {
    try {
      this.currentChampion = await getCurrentChampion();
      this.allPlayersData = await getAllPlayers();
      this.gameID = await getGameId();
    } catch (error) {
      console.error('Error fetching getSchedule:', error);
    }
    this.isGameToday = this.gameID !== null;
    if (this.isGameToday) {
      this.getGameInfo();
    } else {
      this.loading = false;
    }  
  },
  methods: {
    findPlayerTeam(game, player) {
      const homeTeamAbbrev = game.homeTeam.abbrev;
      const awayTeamAbbrev = game.awayTeam.abbrev;

      if (player.teams.includes(homeTeamAbbrev)) {
        return game.homeTeam;
      }
      if (player.teams.includes(awayTeamAbbrev)) {
        return game.awayTeam;
      }
    },
    getGameInfo() {
      // If there is a game today, fetch the game result
      nhlApi.getGameInfo(this.gameID).then(result => {
        this.todaysGame = result.data;
        this.isGameOver = result.data.gameState === 'FINAL';
      }).catch(error => {
        console.error('Error fetching game result:', error);
      }).finally(() => {
        this.playerChampion = this.allPlayersData.find(player => player.teams.includes(this.currentChampion));
        this.playerChallenger = this.allPlayersData.find(player => !player.teams.includes(this.currentChampion) && (player.teams.includes(this.todaysGame.homeTeam.abbrev) || player.teams.includes(this.todaysGame.awayTeam.abbrev)));
        this.playerChampion.team = this.findPlayerTeam(this.todaysGame, this.playerChampion);
        this.playerChallenger.team = this.findPlayerTeam(this.todaysGame, this.playerChallenger);

        // find score and winner
        if (this.isGameOver) {
            const homeTeam = this.todaysGame.homeTeam;
            const awayTeam = this.todaysGame.awayTeam;
            if (this.playerChampion.team.abbrev === homeTeam.abbrev) {
              this.playerChampion.team.score = homeTeam?.score;
              this.playerChallenger.team.score = awayTeam?.score;
              this.todaysWinner = homeTeam?.score > awayTeam?.score ? this.playerChampion : this.playerChallenger;
            } else if (this.playerChampion.team.abbrev === awayTeam.abbrev) {
              this.playerChampion.team.score = awayTeam?.score;
              this.playerChallenger.team.score = homeTeam?.score;
              this.todaysWinner = awayTeam?.score > homeTeam?.score ? this.playerChampion : this.playerChallenger;
            }
        }
        this.loading = false;
      });
    }
  },
};
</script>
