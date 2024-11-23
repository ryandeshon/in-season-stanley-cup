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
          <PlayerCard
            :player="todaysWinner"
            imageType="Winner"
            :isGameLive="isGameLive"
          />
          <div class="flex justify-center items-center"><strong>VS</strong></div>
          <PlayerCard
            :player="todaysLoser"
            imageType="Sad"
            :isGameLive="isGameLive"
          />
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
        <div v-else class="flex flex-row gap-4 justify-center items-center w-full my-4">
          <div>
            <div class="text-center font-bold text-xl mb-2">Champion</div>
              <PlayerCard
                :player="playerChampion"
                imageType="Challenger"
                :isGameLive="isGameLive"
                :isChampion="true"
              />
          </div>
          <div class="flex justify-center items-center"><strong>VS</strong></div>
          <div>
            <div class="text-center font-bold text-xl mb-2">Challenger</div>
              <PlayerCard
                :player="playerChallenger"
                imageType="Challenger"
                :isGameLive="isGameLive"
                :isMirrorMatch="isMirrorMatch"
              />
          </div>
        </div>
        <div class="text-center mb-4">
          <router-link :to="`/game/${todaysGame.id}`" class="text-blue-500 underline">View Game Details</router-link>
        </div>
      </template>

      <!-- Champion is not defending -->
      <template v-else>
        <div class="flex flex-col justify-center items-center my-4">
          <PlayerCard
            :player="playerChampion"
            title="Champion"
            subtitle="is not Defending the Championship Today"
            imageType="Winner"
          />
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
import PlayerCard from '@/components/PlayerCard.vue';

import quotes from '@/utilities/quotes.json';

export default {
  name: 'HomePage',
  components: {
    PlayerCard,
  },
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
    };
  },
  async created() {
    try {
      this.currentChampion = await getCurrentChampion();
      this.gameID = await getGameId();
      // this.currentChampion = "NYR";
      // this.gameID = '2024020247';
      this.allPlayersData = await getAllPlayers();
      // console.log("🚀 ~ created ~ this.allPlayersData:", this.allPlayersData)
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
      const getChallengerTeam = this.currentChampion === homeTeam.abbrev ? awayTeam : homeTeam;

      console.log("🚀 ~ getTeamsInfo ~ this.allPlayersData:", this.allPlayersData)
      this.playerChampion = this.allPlayersData.find(player => player.teams.includes(getChampionTeam.abbrev));
      this.playerChampion.team = getChampionTeam;
      this.playerChallenger = this.allPlayersData.find(player => player.teams.includes(getChallengerTeam.abbrev));
      this.playerChallenger.team = getChallengerTeam;
      
      console.log("🚀 ~ getTeamsInfo ~ this.playerChampion:", this.playerChampion)
      console.log("🚀 ~ getTeamsInfo ~ this.playerChallenger:", this.playerChallenger)

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
</style>
