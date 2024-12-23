<template>
  <v-container class="max-w-screen-md">
    <h1 class="text-4xl font-bold mb-4">Standings</h1>
    <p>View the standings of the players based on their teams' cup reigns.</p>
    <template v-if="loading">
      <div class="flex justify-center items-center mt-10">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>
    </template>
    <div v-else>
      <v-table>
        <thead>
          <tr>
            <th class="text-left">Player</th>
            <th class="text-center">Teams</th>
            <th class="text-left">Title Defenses</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="standing in allPlayersData"
            :key="standing.name"
            class="py-2"
          >
            <td class="text-left font-bold">
              <router-link :to="`/player/${standing.name}`">{{
                standing.name
              }}</router-link>
              <span v-if="standing.name === currentChampion.name" class="ml-1"
                >👑</span
              >
            </td>
            <td class="flex flex-wrap justify-center items-center">
              <div v-for="team in standing.teams" :key="team">
                <img
                  :src="`https://assets.nhle.com/logos/nhl/svg/${team}_${isDarkOrLight}.svg`"
                  :alt="team"
                  class="w-6 h-6"
                />
              </div>
            </td>
            <td class="text-left">{{ standing.titleDefenses }}</td>
          </tr>
        </tbody>
      </v-table>
      <div class="text-sm mt-2">👑 = Current Champion</div>
    </div>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getAllPlayers } from '../services/dynamodbService';
import { getCurrentChampion } from '../services/championServices';
import { useTheme } from 'vuetify';

const loading = ref(true);
const allPlayersData = ref(null);
const currentChampion = ref(null);

const theme = useTheme();
const isDarkOrLight = theme.global.name.value;

onMounted(async () => {
  try {
    const currentChampionTeam = await getCurrentChampion();
    const data = await getAllPlayers();
    allPlayersData.value = data.sort(
      (a, b) => b.titleDefenses - a.titleDefenses
    );
    currentChampion.value = allPlayersData.value.find((player) =>
      player.teams.includes(currentChampionTeam)
    );
    loading.value = false;
  } catch (error) {
    console.error('Error fetching player data:', error);
  }
});
</script>
