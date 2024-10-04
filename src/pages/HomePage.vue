<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Welcome to the In Season Stanley Cup</h1>
    <p>Track the champion and standings of the NHL teams as they compete for the cup.</p>
  </v-container>
</template>

<script>
import nhlApi from '../services/nhlApi';

export default {
  name: 'HomePage',
  data() {
    return {
      schedule: [],
    };
  },
  async created() {
    try {
      const response = await nhlApi.getSchedule();
      console.log("🚀 ~ created ~ response:", response)
      this.schedule = response.data.schedule;
    } catch (error) {
      console.error('Error fetching getSchedule:', error);
    }
  },
};
</script>
