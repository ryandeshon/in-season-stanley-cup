<template>
  <template v-if="loading">
    <div class="flex justify-center items-center mt-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>
  </template>
  <template v-else-if="errorMessage">
    <v-container class="max-w-screen-md game-details-summary">
      <h1 class="text-4xl font-bold mb-4 text-center">Game Details</h1>
      <v-alert type="error" variant="tonal" data-test="game-error">
        {{ errorMessage }}
      </v-alert>
    </v-container>
  </template>
  <template v-else-if="!gameDetails">
    <v-container class="max-w-screen-md game-details-summary">
      <h1 class="text-4xl font-bold mb-4 text-center">Game Details</h1>
      <v-alert type="warning" variant="tonal" data-test="game-empty">
        Game details are not available yet.
      </v-alert>
    </v-container>
  </template>
  <template v-else>
    <v-container class="max-w-screen-md game-details-summary">
      <h1 class="text-4xl font-bold mb-4 text-center">Game Details</h1>
      <v-row class="game-matchup">
        <v-col cols="6" class="text-center">
          <TeamLogo
            :team="gameDetails.awayTeam.abbrev"
            class="mx-auto mb-2"
            width="100"
            height="100"
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
          <TeamLogo
            :team="gameDetails.homeTeam.abbrev"
            class="mx-auto mb-2"
            width="100"
            height="100"
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
      class="max-w-screen-xl game-details-rosters"
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
              { key: 'hits', title: 'Hits' },
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
                <td>{{ formatNumber(item.savePctg) }}</td>
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
              { key: 'hits', title: 'Hits' },
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
                <td>{{ formatNumber(item.savePctg) }}</td>
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
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import nhlApi from '@/services/nhlApi';
import { formatLocalTime } from '@/utilities/localTime';
import TeamLogo from '@/components/TeamLogo.vue';

const loading = ref(true);
const gameDetails = ref(null);
const errorMessage = ref('');
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
    localStartTime.value = formatLocalTime(gameDetails.value.startTimeUTC);
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
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value =
      'Unable to load game details right now. Please try again in a moment.';
    console.error('Error fetching game details:', error);
  } finally {
    loading.value = false;
  }
});

const formatNumber = (num) => {
  if (!num) return 0;
  return parseFloat(num).toFixed(3);
};
</script>

<style scoped>
@media (max-width: 600px) {
  .v-container.game-details-summary,
  .v-container.game-details-rosters {
    padding: 16px 12px 12px;
  }
  .game-details-summary h1 {
    margin-bottom: 12px !important;
  }
  .game-details-summary .v-col,
  .game-details-rosters .v-col {
    padding: 8px;
  }
  .game-details-summary .game-matchup h2 {
    font-size: 20px;
    line-height: 1.25;
    margin-bottom: 8px;
  }
  .game-matchup :deep(.v-img) {
    width: 64px !important;
    height: 64px !important;
  }
  .game-details-summary p {
    margin-bottom: 8px;
    font-size: 14px;
  }
  .game-details-summary h3,
  .game-details-rosters h3 {
    font-size: 20px;
    margin-bottom: 10px;
  }
  .game-details-summary .v-row.mt-4,
  .game-details-rosters .v-row.mt-4 {
    margin-top: 8px !important;
  }
  .game-details-rosters :deep(th) {
    font-size: 12px !important;
  }
  .game-details-rosters :deep(td) {
    padding: 8px !important;
    font-size: 13px;
  }
}
</style>
