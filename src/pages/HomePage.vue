<template>
  <v-container class="max-w-[570px] min-h-32">
    <h1 class="text-4xl font-bold mb-4">In Season Cup</h1>
    <template v-if="loading">
      <div class="flex justify-center items-center mt-10 h-40">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </template>

    <template v-else>
      <!-- Winner for tonight -->
      <template v-if="isGameOver">
        <div class="grid gap-4 grid-cols-2 justify-center items-start my-4">
          <div class="text-center">
            <h2 class="text-xl font-bold mb-2">Champion</h2>
            <p class="text-sm self-start"><em>"{{ getQuote() }}"</em></p>
          </div>
          <div class="text-center">
            <h2 class="text-xl font-bold mb-2">Game Over</h2>
            <div>Final Score: {{ playerChampion.team.score }} - {{ playerChallenger.team.score }}</div>
            <div>Winner: <strong>{{ todaysWinner.name }}</strong></div>
          </div>
        </div>

        <div class="flex flex-row gap-4 justify-center items-center w-full my-4">
          <v-card class="pb-3 sm:min-w-52">
            <v-card-text class="flex flex-col justify-center items-center">
              <router-link :to="`/player/${todaysWinner.name}`"><h3>{{ todaysWinner?.name }}</h3></router-link>
              <div class="avatar">
                <img :src="getImage(todaysWinner?.name, 'Winner')" class="my-2" :alt="`${todaysWinner?.name} Avatar`" />
                <div class="team-logo">
                  <img :src="todaysWinner?.team?.logo" :alt="`${todaysWinner?.team?.placeName.default} Team Logo`" />
                </div>
              </div>
            </v-card-text>
          </v-card>
          <div class="flex justify-center items-center"><strong>VS</strong></div>
          <v-card class="pb-3 sm:min-w-52">
            <v-card-text class="flex flex-col justify-center items-center">
              <router-link :to="`/player/${todaysLoser.name}`"><h3>{{ todaysLoser?.name }}</h3></router-link>
              <div class="avatar">
                <img :src="getImage(todaysLoser?.name, 'Sad')" class="my-2" :alt="`${todaysLoser?.name} Avatar`" />
                <div class="team-logo">
                  <img :src="todaysLoser?.team?.logo" :alt="`${todaysLoser?.team?.placeName.default} Team Logo`" />
                </div>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <!-- Game day -->
      <template v-else-if="isGameToday">
        <div v-if="isGameLive" class="text-center">
          <div>Period: {{ this.todaysGame.clock.inIntermission ? 'INT' : getPeriod }}</div>
          <div>Time Remaining: {{ getClockTime }}</div>
        </div>
        <div v-if="isMirrorMatch" class="text-center">
          <h2 class="text-xl font-bold mb-2">Mirror Match</h2>
        </div>
        <div class="flex flex-row gap-4 justify-center items-center w-full my-4">
          <div>
            <div class="text-center font-bold text-xl mb-2">Champion</div>
            <v-card class="pb-3 sm:min-w-52">
              <v-card-text class="flex flex-col justify-center items-center">
                <router-link :to="`/player/${playerChampion.name}`"><h3>{{ playerChampion?.name }}</h3></router-link>
                <span><strong>{{ playerChampion?.team?.placeName.default }}</strong></span>
                <div v-if="isGameLive" class="text-sm">
                  <div>Score: {{ playerChampion?.team.score }}</div>
                  <div>SOG: {{ playerChampion?.team.sog }}</div>
                </div>
                <div class="avatar">
                  <img :src="getImage(playerChampion?.name, 'Challenger')" class="-scale-x-100 my-2" :alt="`${playerChampion?.name} Avatar`" />
                  <div class="team-logo">
                    <img :src="playerChampion?.team?.logo" :alt="`${playerChampion?.team?.placeName.default} Team Logo`" />
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>
          <div class="flex justify-center items-center"><strong>VS</strong></div>
          <div>
            <div class="text-center font-bold text-xl mb-2">Challenger</div>
            <v-card class="pb-3 sm:min-w-52">
              <v-card-text class="flex flex-col justify-center items-center">
                <router-link :to="`/player/${playerChallenger.name}`"><h3><span v-if="isMirrorMatch" class="text-sm">Evil </span>{{ playerChallenger?.name }}</h3></router-link>
                <span><strong>{{ playerChallenger?.team?.placeName.default }}</strong></span>
                <div v-if="isGameLive" class="text-sm">
                  <div>Score: {{ playerChallenger?.team.score }}</div>
                  <div>SOG: {{ playerChallenger?.team.sog }}</div>
                </div>
                <div class="avatar">
                  <img :src="getImage(playerChallenger?.name, 'Challenger')" :class="{'saturate-50 contrast-125 brightness-75': isMirrorMatch}" class="my-2" :alt="`${playerChallenger?.name} Avatar`" />
                  <div class="team-logo">
                    <img :src="playerChallenger?.team?.logo" :alt="`${playerChallenger?.team?.placeName.default} Team Logo`" />
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </div>
      </template>

      <!-- Champion is not defending -->
      <template v-else>
        <div class="flex flex-col justify-center items-center my-4">
          <v-card class="pb-3">
            <v-card-title><router-link :to="`/player/${playerChampion.name}`">Champion {{ playerChampion?.name }}</router-link></v-card-title>
            <v-card-text class="flex flex-col justify-center items-center">
              <p>is not Defending the Championship Today</p>
              <div class="relative flex flex-col justify-center items-center text-center my-auto w-52">
                <img :src="getImage(playerChampion?.name, 'Winner')" class="my-2" :alt="`${playerChampion?.name} Avatar`" />
                <div class="team-logo">
                  <img :src="`https://assets.nhle.com/logos/nhl/svg/${currentChampion}_light.svg`" :alt="`${playerChampion?.team?.placeName.default} Logo`" />
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
import { DateTime } from 'luxon';
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
      boxScore: {},
      secondsRemaining: null,
      isGameToday: false,
      isGameOver: false,
      isGameLive: false,
      isMirrorMatch: false,
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
      // this.currentChampion = "SJS";
      // this.gameID = '2024020240';
      this.allPlayersData = await getAllPlayers();
    } catch (error) {
      console.error('Error fetching getCurrentChampion or getGameId:', error);
    }
    this.isGameToday = this.gameID !== null;
    if (this.isGameToday) {
      this.getGameInfo();
    } else {
      // If there is no game today, fetch the current champion info
      this.playerChampion = this.allPlayersData.find(player => player.teams.includes(this.currentChampion));
      this.loading = false;
    }  
  },
  computed: {
    getClockTime() {
      return DateTime.fromSeconds(this.secondsRemaining).toFormat('mm:ss');
    },
    getPeriod() {
      if (this.todaysGame.periodDescriptor.periodType === 'OT') {
        return 'OT';
      }
      return this.todaysGame.periodDescriptor.number;
    },
  },
  watch: {
    'todaysGame.clock.secondsRemaining': function(newVal) {
      if (newVal !== undefined) {
        this.secondsRemaining = newVal;
      }
    }
  },
  methods: {
    championImage(name) {
      return this.getImage(name, 'Winner');
    },
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
    findPlayerTeam(team, player) {
      if (player?.teams.includes(team)) {
        return team.homeTeam.abbrev === player.teams[0] ? team.homeTeam : team.awayTeam;
      }
    },
    getGameInfo() {
      // If there is a game today, fetch the game result
      nhlApi.getGameInfo(this.gameID).then(result => {
        this.todaysGame = result.data;
        this.isGameOver = ['FINAL', 'OFF'].includes(result.data.gameState);
      }).catch(error => {
        console.error('Error fetching game result:', error);
      }).finally(() => {
        this.getTeamsInfo();
        this.isGameLive = ['LIVE', 'CRIT'].includes(this.todaysGame.gameState);

        // find score and winner
        if (this.isGameOver) {
            const homeTeam = this.todaysGame.homeTeam;
            const awayTeam = this.todaysGame.awayTeam;
            if (this.playerChampion.team.abbrev === homeTeam.abbrev) {
              this.todaysWinner = homeTeam?.score > awayTeam?.score ? this.playerChampion : this.playerChallenger;
              this.todaysLoser = homeTeam?.score < awayTeam?.score ? this.playerChampion : this.playerChallenger;
            } else if (this.playerChampion.team.abbrev === awayTeam.abbrev) {
              this.todaysWinner = awayTeam?.score > homeTeam?.score ? this.playerChampion : this.playerChallenger;
              this.todaysLoser = awayTeam?.score < homeTeam?.score ? this.playerChampion : this.playerChallenger;
            }
        }
        this.loading = false;
      });
    },
    getTeamsInfo() {
      const homeTeam = this.todaysGame.homeTeam;
      const awayTeam = this.todaysGame.awayTeam;
      const getChampionTeam = this.currentChampion === homeTeam.abbrev ? homeTeam : awayTeam;
      console.log("🚀 ~ getTeamsInfo ~ getChampionTeam:", getChampionTeam)
      const getChallengerTeam = this.currentChampion === homeTeam.abbrev ? awayTeam : homeTeam;
      console.log("🚀 ~ getTeamsInfo ~ getChallengerTeam:", getChallengerTeam)

      this.playerChampion = this.findPlayerTeam(getChampionTeam, this.playerChampion);
      this.playerChampion.team = getChampionTeam;
      this.playerChallenger = this.allPlayersData.find(player => player.teams.includes(getChallengerTeam.abbrev));
      this.playerChallenger.team = getChallengerTeam;
      // console.log("🚀 ~ getTeamsInfo ~ this.playerChampion:", this.playerChampion)
      // console.log("🚀 ~ getTeamsInfo ~ this.playerChallenger:", this.playerChallenger)

      this.isMirrorMatch = this.playerChampion.name === this.playerChallenger.name;
    },
    getQuote() {
      const randomIndex = Math.floor(Math.random() * quotes.length);
      return quotes[randomIndex];
    },
  },
};
</script>

<style>
.avatar {
  @apply relative flex flex-col justify-center items-center text-center my-auto w-28 sm:w-52;
}
.team-logo {
  @apply absolute flex align-middle justify-center -bottom-6 w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full border-2;
}
</style>
