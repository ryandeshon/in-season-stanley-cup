<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Welcome to the In Season Stanley Cup</h1>
    <p>Track the champion and standings of the NHL teams as they compete for the cup.</p>
    <pre class="text-left text-sm">
      {{ schedule }}
    </pre>
  </v-container>
</template>

<script>
import nhlApi from '../services/nhlApi';

export default {
  name: 'HomePage',
  data() {
    return {
      currentChampion: 'NJD',
      todayMatchups: [],
      schedule: [],
    };
  },
  async created() {
    try {
      const response = await nhlApi.getSchedule();
      this.schedule = response.data.gameWeek;
      console.log("🚀 ~ created ~ this.schedule:", this.schedule)
    } catch (error) {
      console.error('Error fetching getSchedule:', error);
    }
  },
};
</script>
