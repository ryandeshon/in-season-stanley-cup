<template>
  <v-container class="max-w-screen-md min-h-32">
    <div v-if="player">
      <div class="flex flex-col justify-center items-center my-4">
        <div v-if="player">
          <v-card class="pb-3">
            <v-card-title><h2 class="text-lg font-bold">{{ player.name }}</h2></v-card-title>
            <v-card-text class="flex flex-col justify-center items-center">
              <div class="relative flex flex-col justify-center items-center text-center my-auto w-52">
                <img :src="avatarImage" class="my-2" :alt="`${player?.name} Avatar`" />
              </div>
              <p>Title Defenses: {{ player.titleDefenses }}</p>
              <p>Championships: {{ player.championships }}</p>
            </v-card-text>
          </v-card>
          <div v-if="playersGamesPlayed" class="my-10">
            <v-table>
              <thead>
              <tr>
                <th class="text-center">Match Up</th>
                <th class="text-center">Result</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="game in playersGamesPlayed" :key="game.id" class="py-2">
                <td class="text-center flex gap-2 justify-center items-center">
                  <img :src="`https://assets.nhle.com/logos/nhl/svg/${game.wTeam}_light.svg`" :alt="game.wTeam" class="w-6 h-6" /> vs. <img :src="`https://assets.nhle.com/logos/nhl/svg/${game.lTeam}_light.svg`" :alt="game.lTeam" class="w-6 h-6" /></td>
                
                <td class="text-center">
                  <div class="text-center flex gap-2 justify-center items-center">
                    <img v-if="getResults(game).team" :src="`https://assets.nhle.com/logos/nhl/svg/${ getResults(game).team }_light.svg`" :alt="game.wTeam" class="w-6 h-6" /> {{ getResults(game).result }}
                  </div>
                </td>
              </tr>
              </tbody>
            </v-table>
            <v-table class="mt-10">
              <thead>
              <tr>
                <th class="text-center">Team</th>
                <th class="text-center">Record</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="team in player.teams" :key="team" class="py-2">
                <td class="text-center flex gap-2 justify-center items-center">
                  <img :src="`https://assets.nhle.com/logos/nhl/svg/${team}_light.svg`" :alt="team" class="w-10 h-10" />
                </td>
                <td class="text-center">{{ getWins(team) }} - {{ getLosses(team) }}</td>
              </tr>
              </tbody>
            </v-table>
          </div>
        </div>
        <div v-else class="flex justify-center items-center mt-10">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script>
import { getPlayerData, getGameRecords } from '../services/dynamodbService';

import bozWinnerImage from '@/assets/players/boz-winner.png';
import terryWinnerImage from '@/assets/players/terry-winner.png';
import cooperWinnerImage from '@/assets/players/cooper-winner.png';
import ryanWinnerImage from '@/assets/players/ryan-winner.png';

export default {
  name: 'PlayerProfile',
  props: ['name'], // Accept the player name as a prop
  data() {
    return {
      player: null,
      allGamesPlayed: null,
      playersGamesPlayed: null,
      bozWinnerImage,
      terryWinnerImage,
      cooperWinnerImage,
      ryanWinnerImage,
    };
  },
  async created() {
    try {
      this.player = await getPlayerData(this.name); // Fetch the player data by name
      const games = await getGameRecords();

      // Manipulate the data as needed
      const filteredGames = games.filter(game => 
        this.player.teams.includes(game.lTeam) || this.player.teams.includes(game.wTeam)
      );

      // Save the manipulated data into data properties
      this.allGamesPlayed = games;
      this.playersGamesPlayed = filteredGames.sort((a, b) => a.id - b.id);

    } catch (error) {
      console.error('Error fetching player data:', error);
    }
  },
  computed: {
    avatarImage() {
      const avatarImages = {
        Boz: this.bozWinnerImage,
        Terry: this.terryWinnerImage,
        Cooper: this.cooperWinnerImage,
        Ryan: this.ryanWinnerImage,
      };
      return avatarImages[this.player?.name] || null;
    },
  },
  methods: {
    getResults(game) {
      if (this.player.teams.includes(game.lTeam) && this.player.teams.includes(game.wTeam)) {
        return { team: null, result: 'Mirror Match' };
      } 
      
      if (this.player.teams.includes(game.lTeam)) {
        return { team: game.lTeam, result: 'Loss' };
      } else if (this.player.teams.includes(game.wTeam)) {
        return { team: game.wTeam, result: 'Win' };
      }
      return { team: 'Unknown', result: 'Unknown' };
    },
    getWins(team) {
      return this.playersGamesPlayed.filter(game => game.wTeam === team).length;
    },
    getLosses(team) {
      return this.playersGamesPlayed.filter(game => game.lTeam === team).length;
    }
  },

 
};
</script>
