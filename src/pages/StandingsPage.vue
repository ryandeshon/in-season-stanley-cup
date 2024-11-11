<template>
  <v-container class="max-w-screen-md">
    <h1 class="text-4xl font-bold mb-4">Standings</h1>
    <p>View the standings of the players based on their teams' cup reigns.</p>
    <template v-if="loading">
      <div class="flex justify-center items-center mt-10">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
    </template>
    <v-table v-else>
      <thead>
      <tr>
        <th class="text-left">Player</th>
        <th class="text-center">Teams</th>
        <th class="text-left">Title Defenses</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(standing, index) in allPlayersData" :key="standing.name" :class="{'bg-amber-200': index === 0}" class="py-2">
        <td class="text-left font-bold">
          <router-link :to="`/player/${standing.name}`">{{ standing.name }}</router-link>
        </td>
        <th class="flex flex-wrap justify-center align-center">
          <div v-for="team in standing.teams" :key="team">
            <img :src="`https://assets.nhle.com/logos/nhl/svg/${team}_light.svg`" :alt="team" class="w-6 h-6" />
          </div>
        </th>
        <td class="text-left">{{ standing.titleDefenses }}</td>
      </tr>
      </tbody>
    </v-table>
  </v-container>
</template>

<script>
import { getAllPlayers } from '../services/dynamodbService';

export default {

  name: 'StandingsPage',
  data() {
    return {
      loading: true,
      allPlayersData: null,
    };
  },
  async mounted() {
    try {
      const data = await getAllPlayers();
      this.allPlayersData = data.sort((a, b) => b.titleDefenses - a.titleDefenses);
      this.loading = false;
    } catch (error) {
      console.error('Error fetching player data:', error);
    }
  },
};
</script>
