<template>
  <div v-if="player">
    <div class="flex flex-col justify-center align-center my-4">
      <v-card v-if="player" class="pb-3">
        <v-card-title><h2 class="text-lg font-bold">{{ player.name }}</h2></v-card-title>
        <v-card-text class="flex flex-col justify-center align-center">
          <div class="relative flex flex-col justify-center align-center text-center my-auto w-52">
            <img :src="avatarImage" class="my-2" :alt="`${player?.name} Avatar`" />
          </div>
          <p>Title Defenses: {{ player.titleDefenses }}</p>
          <p>Championships: {{ player.championships }}</p>
        </v-card-text>
      </v-card>
      <div v-else class="flex justify-center items-center mt-10">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </div>
  </div>
</template>

<script>
import { getPlayerData } from '../services/dynamodbService';

import bozWinnerImage from '@/assets/boz-winner.png';
import terryWinnerImage from '@/assets/terry-winner.png';
import cooperWinnerImage from '@/assets/cooper-winner.png';
import ryanWinnerImage from '@/assets/ryan-winner.png';

export default {
  name: 'PlayerProfile',
  props: ['name'], // Accept the player name as a prop
  data() {
    return {
      player: null,
      bozWinnerImage,
      terryWinnerImage,
      cooperWinnerImage,
      ryanWinnerImage,
    };
  },
  async created() {
    try {
      this.player = await getPlayerData(this.name); // Fetch the player data by name
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
 
};
</script>
