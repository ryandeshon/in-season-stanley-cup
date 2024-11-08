<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Standings</h1>
    <p>View the standings of the players based on their teams' cup reigns.</p>
    <v-table v-if="allPlayersData">
      <thead>
      <tr>
        <th class="text-left">Player</th>
        <th class="text-center">Teams</th>
        <th class="text-left">Days as Champion</th>
        <th class="text-left">Title Defenses</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="standing in allPlayersData" :key="standing.name" class="py-2">
        
        <td class="text-left font-bold">{{ standing.name }}</td>
        <th class="flex flex-wrap justify-center align-center">
          <div v-for="team in standing.teams" :key="team">
            <img :src="`https://assets.nhle.com/logos/nhl/svg/${team}_light.svg`" :alt="team" class="w-6 h-6" />
          </div>
        </th>
        <td class="text-left">{{ standing.daysAsChampion }}</td>
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
      allPlayersData: null,
    };
  },
  async created() {
    this.allPlayersData = await getAllPlayers();
  },
};
</script>
