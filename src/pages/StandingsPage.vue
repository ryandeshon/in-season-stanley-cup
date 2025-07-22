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
          <tr class="font-bold text-lg">
            <th class="text-left">Player</th>
            <th class="text-center">Teams</th>
            <th class="text-center">Title Defenses</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="standing in allPlayersData"
            :key="standing.name"
            class="py-2"
          >
            <td class="text-left font-bold align-middle">
              <router-link :to="`/player/${standing.name}`">{{
                standing.name
              }}</router-link>
              <img
                v-if="standing.name === currentChampion.name"
                :src="Crown"
                alt="Crown"
                class="inline ml-1 w-8 h-8"
              />
            </td>
            <td class="align-top">
              <div class="flex flex-wrap justify-center items-start gap-1 py-2">
                <TeamLogo
                  v-for="team in standing.teams"
                  :key="team"
                  :team="team"
                  width="40"
                  height="40"
                />
              </div>
            </td>
            <td class="text-center align-middle">
              {{ standing.titleDefenses }}
            </td>
          </tr>
        </tbody>
      </v-table>
      <div class="text-sm my-2">
        <img :src="Crown" alt="Crown" class="inline w-8 h-8 mr-1" /> = Current
        Champion
      </div>
    </div>
    <template v-if="totalGamesPlayed">
      <h2 class="text-center text-xl font-bold">Season Progress</h2>
      <v-progress-linear
        v-model="totalGamesPercentage"
        color="primary"
        height="20"
        class="my-4"
      >
        <template v-slot:default="{ value }">
          <strong>{{ Math.ceil(value) }}%</strong>
        </template>
      </v-progress-linear>
      <div class="text-center text-sm">
        <span>{{ totalGamesPlayed }} Games Played</span>
      </div>
    </template>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getAllPlayers, getGameRecords } from '../services/dynamodbService';
import { getCurrentChampion } from '../services/championServices';
import TeamLogo from '@/components/TeamLogo.vue';
import Crown from '@/assets/crown.png';

const loading = ref(true);
const allPlayersData = ref(null);
const currentChampion = ref(null);
const totalGamesPlayed = ref(0);
const totalGamesPercentage = ref(0);

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
    // Get percentage of games played
    totalGamesPlayed.value = (await getGameRecords()).length;
    totalGamesPercentage.value = (totalGamesPlayed.value / 87) * 100;
    loading.value = false;
  } catch (error) {
    console.error('Error fetching player data:', error);
  }
});
</script>
