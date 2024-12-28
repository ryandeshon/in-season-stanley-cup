<template>
  <template v-if="loading">
    <div class="flex justify-center items-center mt-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>
  </template>
  <template v-else>
    <v-container class="max-w-screen-md">
      <h1 class="text-4xl font-bold mb-4">Game Details</h1>
      <v-row>
        <v-col cols="6" class="text-center">
          <v-img
            :src="
              isDarkOrLight === 'dark'
                ? gameDetails.awayTeam.darkLogo
                : gameDetails.awayTeam.logo
            "
            class="mx-auto mb-2"
            max-width="100"
          />
          <h2 class="text-2xl font-bold">
            {{ gameDetails.awayTeam.placeName.default }}
            {{ gameDetails.awayTeam.commonName.default }}
          </h2>
          <template v-if="gameDetails?.gameState !== 'FUT'">
            <p>Score: {{ gameDetails.awayTeam.score }}</p>
            <p>Shots on Goal: {{ gameDetails.awayTeam.sog }}</p>
          </template>
        </v-col>
        <v-col cols="6" class="text-center">
          <v-img
            :src="
              isDarkOrLight === 'dark'
                ? gameDetails.homeTeam.darkLogo
                : gameDetails.homeTeam.logo
            "
            class="mx-auto mb-2"
            max-width="100"
          />
          <h2 class="text-2xl font-bold">
            {{ gameDetails.homeTeam.placeName.default }}
            {{ gameDetails.homeTeam.commonName.default }}
          </h2>
          <template v-if="gameDetails?.gameState !== 'FUT'">
            <p>Score: {{ gameDetails.homeTeam.score }}</p>
            <p>Shots on Goal: {{ gameDetails.homeTeam.sog }}</p>
          </template>
        </v-col>
      </v-row>
      <v-row class="mt-4">
        <v-col cols="12" class="text-center">
          <h3 class="text-xl font-bold">Game Information</h3>
          <p>{{ localStartTime }}</p>
          <p>
            Venue: {{ gameDetails.venue.default }},
            {{ gameDetails.venueLocation.default }}
          </p>
        </v-col>
      </v-row>
    </v-container>
    <v-container
      v-if="gameDetails?.gameState !== 'FUT'"
      class="max-w-screen-xl"
    >
      <v-row class="mt-4">
        <v-col cols="12" sm="6">
          <h3 class="text-xl font-bold text-center">Away Team Players</h3>
          <v-data-table-virtual
            class="mb-4"
            :items="awayTeamPlayers"
            :headers="[
              { key: 'sweaterNumber', title: '#' },
              { key: 'name', title: 'Name' },
              { key: 'goals', title: 'Goals' },
              { key: 'assists', title: 'Assists' },
              { key: 'sog', title: 'SOG' },
              { key: 'plusMinus', title: '+/-' },
              { hits: 'hits', title: 'Hits' },
            ]"
          >
            <template #item="{ item, index }">
              <tr :data-test="`index-${index}`">
                <td>{{ item.sweaterNumber }}</td>
                <td>{{ item.name.default }}</td>
                <td>{{ item.goals }}</td>
                <td>{{ item.assists }}</td>
                <td>{{ item.sog }}</td>
                <td>{{ item.plusMinus }}</td>
                <td>{{ item.hits }}</td>
              </tr>
            </template>
          </v-data-table-virtual>
          <h3 class="text-xl font-bold text-center">Away Team Goalies</h3>
          <v-data-table-virtual
            class="mb-4"
            :items="awayTeamGoalies"
            :headers="[
              { key: 'sweaterNumber', title: '#' },
              { key: 'name', title: 'Name' },
              { key: 'shotsAgainst', title: 'SA' },
              { key: 'saves', title: 'SV' },
              { key: 'goalsAgainst', title: 'GA' },
              { key: 'savePctg', title: 'SV%' },
              { key: 'toi', title: 'TOI' },
            ]"
          >
            <template #item="{ item, index }">
              <tr :data-test="`index-${index}`">
                <td>{{ item.sweaterNumber }}</td>
                <td>{{ item.name.default }}</td>
                <td>{{ item.shotsAgainst }}</td>
                <td>{{ item.saves }}</td>
                <td>{{ item.goalsAgainst }}</td>
                <td>{{ item.savePctg }}</td>
                <td>{{ item.toi }}</td>
              </tr>
            </template>
          </v-data-table-virtual>
        </v-col>
        <v-col cols="12" sm="6">
          <h3 class="text-xl font-bold text-center">Home Team Players</h3>
          <v-data-table-virtual
            class="mb-4"
            :items="homeTeamPlayers"
            :headers="[
              { key: 'sweaterNumber', title: '#' },
              { key: 'name', title: 'Name' },
              { key: 'goals', title: 'Goals' },
              { key: 'assists', title: 'Assists' },
              { key: 'sog', title: 'SOG' },
              { key: 'plusMinus', title: '+/-' },
              { hits: 'hits', title: 'Hits' },
            ]"
          >
            <template #item="{ item, index }">
              <tr :data-test="`index-${index}`">
                <td>{{ item.sweaterNumber }}</td>
                <td>{{ item.name.default }}</td>
                <td>{{ item.goals }}</td>
                <td>{{ item.assists }}</td>
                <td>{{ item.sog }}</td>
                <td>{{ item.plusMinus }}</td>
                <td>{{ item.hits }}</td>
              </tr>
            </template>
          </v-data-table-virtual>
          <h3 class="text-xl font-bold text-center">Home Team Goalies</h3>
          <v-data-table-virtual
            class="mb-4"
            :items="homeTeamGoalies"
            :headers="[
              { key: 'sweaterNumber', title: '#' },
              { key: 'name', title: 'Name' },
              { key: 'shotsAgainst', title: 'SA' },
              { key: 'saves', title: 'SV' },
              { key: 'goalsAgainst', title: 'GA' },
              { key: 'savePctg', title: 'SV%' },
              { key: 'toi', title: 'TOI' },
            ]"
          >
            <template #item="{ item, index }">
              <tr :data-test="`index-${index}`">
                <td>{{ item.sweaterNumber }}</td>
                <td>{{ item.name.default }}</td>
                <td>{{ item.shotsAgainst }}</td>
                <td>{{ item.saves }}</td>
                <td>{{ item.goalsAgainst }}</td>
                <td>{{ item.savePctg }}</td>
                <td>{{ item.toi }}</td>
              </tr>
            </template>
          </v-data-table-virtual>
        </v-col>
      </v-row>
    </v-container>
  </template>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import nhlApi from '@/services/nhlApi';
import { DateTime } from 'luxon';
import { useTheme } from 'vuetify';

const theme = useTheme();
const isDarkOrLight = ref(theme.global.name.value);

watch(
  () => theme.global.name.value,
  (newVal) => {
    isDarkOrLight.value = newVal;
  },
  { immediate: true }
);

const loading = ref(true);
const gameDetails = ref(null);
const localStartTime = ref(null);
const homeTeamPlayers = ref([]);
const homeTeamGoalies = ref([]);
const awayTeamPlayers = ref([]);
const awayTeamGoalies = ref([]);

const route = useRoute();

onMounted(async () => {
  const gameId = route.params.id;
  try {
    const response = await nhlApi.getGameInfo(gameId);
    gameDetails.value = response.data;
    localStartTime.value = DateTime.fromISO(
      gameDetails.value.startTimeUTC
    ).toLocaleString(DateTime.DATETIME_FULL);
    if (!gameDetails.value?.playerByGameStats?.homeTeam) return;
    homeTeamPlayers.value =
      gameDetails.value.playerByGameStats.homeTeam.forwards.concat(
        gameDetails.value.playerByGameStats.homeTeam.defense
      );
    homeTeamGoalies.value =
      gameDetails.value.playerByGameStats.homeTeam.goalies;
    awayTeamPlayers.value =
      gameDetails.value.playerByGameStats.awayTeam.forwards.concat(
        gameDetails.value.playerByGameStats.awayTeam.defense
      );
    awayTeamGoalies.value =
      gameDetails.value.playerByGameStats.awayTeam.goalies;

    console.log('🚀 ~ onMounted ~ gameDetails:', gameDetails.value);
  } catch (error) {
    console.error('Error fetching game details:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* Add any styles you need here */
</style>
