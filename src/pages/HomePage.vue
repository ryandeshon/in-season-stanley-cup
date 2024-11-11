<template>
  <v-container class="max-w-screen-md min-h-32">
    <template v-if="loading">
      <div class="flex justify-center items-center mt-10 h-40">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </template>

    <template v-else>
      <!-- Winner for tonight -->
      <template v-if="isGameOver">
        <div class="grid gap-4 grid-cols-2 justify-center align-center my-4">
          <div>
            <p class="text-right self-start my-5"><em>"{{ getQuote() }}"</em></p>
          </div>
          <div>
            <h2 class="text-2xl font-bold mb-4">Game Over</h2>
            <p>Final Score: {{ playerChampion.team.score }} - {{ playerChallenger.team.score }}</p>
            <p>Winner: <strong>{{ todaysWinner.name }}</strong></p>
          </div>
        </div>

        <div class="flex flex-row gap-4 justify-center align-center w-full my-4">
          <v-card class="pb-3 sm:min-w-52">
            <v-card-title>Champion</v-card-title>
            <v-card-text class="flex flex-col justify-center align-center">
              <router-link :to="`/player/${playerChampion.name}`"><h2 class="text-lg font-bold">{{ todaysWinner?.name }}</h2></router-link>
              <div class="relative flex flex-col justify-center align-center text-center my-auto w-36">
                <img :src="championImage" class="my-2" :alt="`${todaysWinner?.name} Avatar`" />
                <div class="team-logo sm:-right-4">
                  <img :src="todaysWinner?.team?.logo" alt="Champion Team Logo" />
                </div>
              </div>
            </v-card-text>
          </v-card>
          <div class="flex justify-center items-center"><strong>VS</strong></div>
          <v-card class="pb-3 sm:min-w-52">
            <v-card-title>Loser</v-card-title>
            <v-card-text class="flex flex-col justify-center align-center">
              <router-link :to="`/player/${todaysLoser.name}`"><h2 class="text-lg font-bold">{{ todaysLoser?.name }}</h2></router-link>
              <div class="relative flex flex-col justify-center align-center text-center my-auto w-36">
                <img :src="sadImage" class="my-2" :alt="`${todaysLoser?.name} Avatar`" />
                <div class="team-logo sm:-left-4">
                  <img :src="todaysLoser?.team?.logo" alt="Losing Team Logo" />
                </div>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <!-- Game day -->
      <template v-else-if="isGameToday">
        <div class="flex flex-col sm:flex-row gap-4 justify-center align-center w-full my-4">
          <v-card class="pb-3 sm:min-w-52">
            <v-card-title>Champion</v-card-title>
            <v-card-text class="flex flex-col justify-center align-center">
              <router-link :to="`/player/${playerChampion.name}`"><h2 class="text-lg font-bold">{{ playerChampion?.name }}</h2></router-link>
              <p>{{ playerChampion?.team?.placeName.default }}</p>
              <div class="relative flex flex-col justify-center align-center text-center my-auto w-36">
                <img :src="championImage" class="my-2" :alt="`${playerChampion?.name} Avatar`" />
                <div class="team-logo sm:-right-4">
                  <img :src="playerChampion?.team?.logo" alt="Champion Team Logo" />
                </div>
              </div>
            </v-card-text>
          </v-card>
          <div class="flex justify-center items-center"><strong>VS</strong></div>
          <v-card class="pb-3 sm:min-w-52">
            <v-card-title>Challenger</v-card-title>
            <v-card-text class="flex flex-col justify-center align-center">
              <router-link :to="`/player/${playerChallenger.name}`"><h2 class="text-lg font-bold">{{ playerChallenger?.name }}</h2></router-link>
              <p>{{ playerChallenger?.team?.placeName.default }}</p>
              <div class="relative flex flex-col justify-center align-center text-center my-auto w-36">
                <img :src="challengerImage" class="my-2" :alt="`${playerChallenger?.name} Avatar`" />
                <div class="team-logo sm:-left-4">
                  <img :src="playerChallenger?.team?.logo" alt="Challenger Team Logo" />
                </div>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <!-- Champion is not defending -->
      <template v-else>
        <div class="flex flex-col justify-center align-center my-4">
          <v-card class="pb-3">
            <v-card-title><router-link :to="`/player/${playerChampion.name}`">Champion {{ playerChampion?.name }}</router-link></v-card-title>
            <v-card-text class="flex flex-col justify-center align-center">
              <p>is not Defending the Championship Today</p>
              <div class="relative flex flex-col justify-center align-center text-center my-auto w-52">
                <img :src="championImage" class="my-2" :alt="`${playerChampion?.name} Avatar`" />
                <div class="team-logo -right-4">
                  <img :src="`https://assets.nhle.com/logos/nhl/svg/${currentChampion}_light.svg`" alt="Challenger Team Logo" />
                </div>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </template>
    </template>
  </v-container>
</template>

<script>
import nhlApi from '../services/nhlApi';
import { getAllPlayers } from '../services/dynamodbService';
import { getCurrentChampion, getGameId } from '../services/championServices';

import quotes from '@/utilities/quotes.json';
import bozWinnerImage from '@/assets/players/boz-winner.png';
import terryWinnerImage from '@/assets/players/terry-winner.png';
import cooperWinnerImage from '@/assets/players/cooper-winner.png';
import ryanWinnerImage from '@/assets/players/ryan-winner.png';
import bozChallengerImage from '@/assets/players/boz-challenger.png';
import terryChallengerImage from '@/assets/players/terry-challenger.png';
import cooperChallengerImage from '@/assets/players/cooper-challenger.png';
import ryanChallengerImage from '@/assets/players/ryan-challenger.png';
import bozSadImage from '@/assets/players/boz-sad.png';
import terrySadImage from '@/assets/players/terry-sad.png';
import cooperSadImage from '@/assets/players/cooper-sad.png';
import ryanSadImage from '@/assets/players/ryan-sad.png';

export default {
  name: 'HomePage',
  data() {
    return {
      loading: true,
      currentChampion: null,
      todaysGame: {},
      todaysWinner: {},
      todaysLoser: {},
      allPlayersData: {},
      playerChampion: {},
      playerChallenger: {},
      isGameToday: false,
      isGameOver: false,
      gameID: null,
      bozWinnerImage,
      terryWinnerImage,
      cooperWinnerImage,
      ryanWinnerImage,
      bozChallengerImage,
      terryChallengerImage,
      cooperChallengerImage,
      ryanChallengerImage,
      bozSadImage,
      terrySadImage,
      cooperSadImage,
      ryanSadImage,
    };
  },
  async created() {
    try {
      this.currentChampion = await getCurrentChampion();
      this.gameID = await getGameId();
      // this.currentChampion = "BOS";
      // this.gameID = '2024020208';
      this.allPlayersData = await getAllPlayers();
    } catch (error) {
      console.error('Error fetching getSchedule:', error);
    }
    this.isGameToday = this.gameID !== null;
    if (this.isGameToday) {
      this.getGameInfo();
    } else {
      // If there is no game today, fetch the current champion info
      this.getChampionInfo();
      this.loading = false;
    }  
  },
  computed: {
    championImage() {
      return this.getImage(this.playerChampion?.name, 'Winner');
    },
    challengerImage() {
      return this.getImage(this.playerChallenger?.name, 'Challenger');
    },
    sadImage() {
      return this.getImage(this.todaysLoser?.name, 'Sad');
    },
  },
  methods: {
    getImage(playerName, type) {
      const images = {
        Boz: {
          Winner: this.bozWinnerImage,
          Challenger: this.bozChallengerImage,
          Sad: this.bozSadImage,
        },
        Terry: {
          Winner: this.terryWinnerImage,
          Challenger: this.terryChallengerImage,
          Sad: this.terrySadImage,
        },
        Cooper: {
          Winner: this.cooperWinnerImage,
          Challenger: this.cooperChallengerImage,
          Sad: this.cooperSadImage,
        },
        Ryan: {
          Winner: this.ryanWinnerImage,
          Challenger: this.ryanChallengerImage,
          Sad: this.ryanSadImage,
        },
      };
      return images[playerName]?.[type] || null;
    },
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
        console.log("🚀 ~ nhlApi.getGameInfo ~ this.todaysGame:", this.todaysGame)
        this.isGameOver = result.data.gameState === 'FINAL';
      }).catch(error => {
        console.error('Error fetching game result:', error);
      }).finally(() => {
        this.getChampionInfo();
        this.playerChampion.team = this.findPlayerTeam(this.todaysGame, this.playerChampion);
        this.playerChallenger = this.allPlayersData.find(player => !player.teams.includes(this.currentChampion) && (player.teams.includes(this.todaysGame.homeTeam.abbrev) || player.teams.includes(this.todaysGame.awayTeam.abbrev)));
        this.playerChallenger.team = this.findPlayerTeam(this.todaysGame, this.playerChallenger);

        // find score and winner
        if (this.isGameOver) {
            const homeTeam = this.todaysGame.homeTeam;
            const awayTeam = this.todaysGame.awayTeam;
            if (this.playerChampion.team.abbrev === homeTeam.abbrev) {
              this.playerChampion.team.score = homeTeam?.score;
              this.playerChallenger.team.score = awayTeam?.score;
              this.todaysWinner = homeTeam?.score > awayTeam?.score ? this.playerChampion : this.playerChallenger;
              this.todaysLoser = homeTeam?.score < awayTeam?.score ? this.playerChampion : this.playerChallenger;
            } else if (this.playerChampion.team.abbrev === awayTeam.abbrev) {
              this.playerChampion.team.score = awayTeam?.score;
              this.playerChallenger.team.score = homeTeam?.score;
              this.todaysWinner = awayTeam?.score > homeTeam?.score ? this.playerChampion : this.playerChallenger;
              this.todaysLoser = awayTeam?.score < homeTeam?.score ? this.playerChampion : this.playerChallenger;
            }
        }
        this.loading = false;
      });
    },
    getChampionInfo() {
      this.playerChampion = this.allPlayersData.find(player => player.teams.includes(this.currentChampion));
    },
    getQuote() {
      const randomIndex = Math.floor(Math.random() * quotes.length);
      return quotes[randomIndex];
    },
  },
};
</script>

<style>
.team-logo {
  @apply absolute flex align-middle justify-center -bottom-3 w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full border-2;
}
</style>
