<template>
  <v-container>
    <h1>Welcome to the In Season Stanley Cup</h1>
    <p>Track the champion and standings of the NHL teams as they compete for the cup.</p>

    <div>
      <h1>NHL Teams</h1>
      <ul>
        <li v-for="team in teams" :key="team.id">{{ team.name }}</li>
      </ul>
    </div>
  </v-container>
</template>

<script>
import nhlApi from '../services/nhlApi';

export default {
  name: 'HomePage',
  data() {
    return {
      teams: [],
    };
  },
  async created() {
    try {
      const response = await nhlApi.getTeams();
      this.teams = response.data.teams;
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  },
};
</script>
