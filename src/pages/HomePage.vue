<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Welcome to the In Season Stanley Cup</h1>
    <p>Track the champion and standings of the NHL teams as they compete for the cup.</p>

    <template v-if="isGameOver">
      <div class="flex flex-col justify-center align-center">
        <h2 class="text-2xl font-bold mb-4">Game Over</h2>
        <p>Final Score: {{ playerChampion.team.score }} - {{ playerChallenger.team.score }}</p>
        <p>Winner: {{ todaysWinner.name }}</p>
        <img :src="todaysWinner.team.logo" class="w-28 mt-4" alt="Winner Team Logo" />
      </div>
    </template>

    <template v-else-if="isGameToday">
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
            <img :src="playerChallenger?.team.logo" alt="Challenger Team Logo" />
          </v-card-text>
        </v-card>
      </div>
    </template>

    <template v-else>
      <p>No games today.</p>
    </template>
  </v-container>
</template>

<script>
import nhlApi from '../services/nhlApi';
import { getAllPlayers } from '../services/dynamodbService';
import { DateTime } from 'luxon';

export default {
  name: 'HomePage',
  data() {
    return {
      currentChampion: 'CAR', // Set the current champion team abbreviation
      todaysDate: DateTime.now().toFormat('yyyy-MM-dd'),
      todaysGames: [],
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
      this.allPlayersData = await getAllPlayers();
      nhlApi.getSchedule().then(response => {
        const gameWeek = response.data.gameWeek;
        console.log("🚀 ~ nhlApi.getSchedule ~ gameWeek:", gameWeek)
        const todaysGames = gameWeek?.find(day => day.date === this.todaysDate);
        this.todaysGames = todaysGames ? todaysGames.games : [];
        console.log("🚀 ~ nhlApi.getSchedule ~ this.todaysGames:", this.todaysGames)
      })
      .catch(error => {
        console.error('Error fetching schedule:', error);
      })
      .finally(() => {
        this.getGameInfo();
      });
    } catch (error) {
      console.error('Error fetching getSchedule:', error);
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
      this.todaysGames.forEach(game => {
        const isChampionPlaying = game.homeTeam.abbrev === this.currentChampion || game.awayTeam.abbrev === this.currentChampion;
        if (isChampionPlaying) {
          this.isGameToday = true;
          this.gameID = game.id;

          this.playerChampion = this.allPlayersData.find(player => player.teams.includes(this.currentChampion));
          this.playerChallenger = this.allPlayersData.find(player => !player.teams.includes(this.currentChampion) && (player.teams.includes(game.homeTeam.abbrev) || player.teams.includes(game.awayTeam.abbrev)));

          this.playerChampion.team = this.findPlayerTeam(game, this.playerChampion);
          this.playerChallenger.team = this.findPlayerTeam(game, this.playerChallenger);

          // If a game is found, no need to continue checking other games
          return;
        }

        // If there is a game today, fetch the game result
        if (this.isGameToday) {
          nhlApi.getResult(this.gameID).then(result => {
            this.todaysGame = result.data;
            this.isGameOver = result.data.gameState === 'OFF';
            // find score and winner
            if (this.isGameOver) {
                const homeTeam = result.data.homeTeam;
                const awayTeam = result.data.awayTeam;
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
          }).catch(error => {
            console.error('Error fetching game result:', error);
          });
        }
      });
    }
  },
};
</script>
