<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Welcome to the In Season Stanley Cup</h1>
    <p>Track the champion and standings of the NHL teams as they compete for the cup.</p>
    <template v-if="isGameToday">
      <div class="grid grid-cols-3 gap-4 w-full my-4">
        <v-card>
          <v-card-title>Champion</v-card-title>
          <v-card-text>
            <p>{{ playerChampion?.name }}</p>
            <p>{{ playerChampion?.team?.placeName.default }}</p>
            <img :src="playerChampion?.team?.logo" alt="Challenger Team Logo" />
            <!-- <pre class="text-left">{{ playerChampion }}</pre> -->
          </v-card-text>
        </v-card>
        <div class="flex justify-center align-center"><strong>VS</strong></div>
        <v-card>
          <v-card-title>Challenger</v-card-title>
          <v-card-text>
            <p>{{ playerChallenger?.name }}</p>
            <p>{{ playerChallenger?.team?.placeName.default }}</p>
            <img :src="playerChallenger?.team.logo" alt="Challenger Team Logo" />
            <!-- <pre>{{ playerChallenger }}</pre> -->
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
      currentChampion: 'FLA',
      todaysDate: DateTime.now().plus({days: 1}).toFormat('yyyy-MM-dd'),
      todaysGames: [],
      todaysWinner: null,
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

      console.log('AWS Region:', process.env.VUE_APP_AWS_REGION);
      console.log('AWS Access Key ID:', process.env.VUE_APP_AWS_ACCESS_KEY_ID);
      console.log('AWS Secret Access Key:', process.env.VUE_APP_AWS_SECRET_ACCESS_KEY);

      this.allPlayersData = await getAllPlayers();
      const response = await nhlApi.getSchedule();
      const gameWeek = response.data.gameWeek;
      const todaysGames = gameWeek.find(day => day.date === this.todaysDate);
      this.todaysGames = todaysGames ? todaysGames.games : [];
      console.log("🚀 ~ created ~ this.todaysGames:", this.todaysGames)

      
      this.todaysGames.forEach(game => {
        const isChampionPlaying = game.homeTeam.abbrev === this.currentChampion || game.awayTeam.abbrev === this.currentChampion;
        if (isChampionPlaying) {
          this.isGameToday = true;
          this.gameID = game.id;

          this.playerChampion = this.allPlayersData.find(player => player.teams.includes(this.currentChampion));
          this.playerChallenger = this.allPlayersData.find(player => !player.teams.includes(this.currentChampion) && player.teams.includes(game.homeTeam.abbrev) || player.teams.includes(game.awayTeam.abbrev));

          this.playerChampion.team = this.findPlayerTeam(game, this.playerChampion);
          this.playerChallenger.team = this.findPlayerTeam(game, this.playerChallenger);
        }
      });

      // this.isGameOver = await nhlApi.getResult(this.gameID);
      // console.log("🚀 ~ created ~ this.isGameOver:", this.isGameOver)

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
    }
  },
};
</script>
