<template>
  <v-container class="max-w-screen-md">
    <h1 class="text-4xl font-bold mb-4">Game Details</h1>
    <template v-if="loading">
      <div class="flex justify-center items-center mt-10">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </template>
    <template v-else>
      <v-row>
        <v-col cols="6" class="text-center">
          <v-img :src="gameDetails.awayTeam.logo" class="mx-auto mb-2" max-width="100"></v-img>
          <h2 class="text-2xl font-bold">{{ gameDetails.awayTeam.placeName.default }} {{ gameDetails.awayTeam.name.default }}</h2>
          <p>Score: {{ gameDetails.awayTeam.score }}</p>
          <p>Shots on Goal: {{ gameDetails.awayTeam.sog }}</p>
        </v-col>
        <v-col cols="6" class="text-center">
          <v-img :src="gameDetails.homeTeam.logo" class="mx-auto mb-2" max-width="100"></v-img>
          <h2 class="text-2xl font-bold">{{ gameDetails.homeTeam.placeName.default }} {{ gameDetails.homeTeam.name.default }}</h2>
          <p>Score: {{ gameDetails.homeTeam.score }}</p>
          <p>Shots on Goal: {{ gameDetails.homeTeam.sog }}</p>
        </v-col>
      </v-row>
      <v-row class="mt-4">
        <v-col cols="12" class="text-center">
          <h3 class="text-xl font-bold">Game Information</h3>
          <p>{{ localStartTime}}</p>
          <p>Venue: {{ gameDetails.venue.default }}, {{ gameDetails.venueLocation.default }}</p>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script>
import nhlApi from '@/services/nhlApi';
import { DateTime } from 'luxon';
// import { getGameRecords } from '../services/dynamodbService';

export default {
  name: 'GamePage',
  data() {
    return {
      loading: true,
      gameDetails: null,
      localStartTime: null,
    };
  },
  async created() {
    const gameId = this.$route.params.id; // Assuming the route has a dynamic segment for game ID
    try {
      const response = await nhlApi.getGameInfo(gameId);
      this.gameDetails = response.data;
      this.localStartTime = DateTime.fromISO(this.gameDetails.startTimeUTC).toLocaleString(DateTime.DATETIME_FULL);
    } catch (error) {
      console.error('Error fetching game details:', error);
    } finally {
      this.loading = false;
    }
  },
};
</script>

<style scoped>
/* Add any styles you need here */
</style>