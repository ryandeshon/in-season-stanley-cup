<template>
  <div>
    <h1>NHL Teams</h1>
    <ul>
      <li v-for="team in teams" :key="team.id">{{ team.name }}</li>
    </ul>
  </div>
</template>

<script>
import nhlApi from '../services/nhlApi';

export default {
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
