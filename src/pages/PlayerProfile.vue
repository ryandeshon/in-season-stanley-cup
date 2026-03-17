<template>
  <v-container class="max-w-screen-xl min-h-32 px-4 sm:px-6">
    <div v-if="loading" class="flex justify-center items-center mt-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>
    <v-alert
      v-else-if="profileErrorMessage"
      type="error"
      variant="tonal"
      data-test="player-profile-error"
    >
      {{ profileErrorMessage }}
    </v-alert>
    <v-alert
      v-else-if="!player"
      type="warning"
      variant="tonal"
      data-test="player-profile-empty"
    >
      Player profile is not available.
    </v-alert>
    <div v-else class="w-full flex flex-col justify-center items-center my-4">
      <v-card class="profile-section pb-3">
        <v-card-text class="flex flex-col justify-center items-center">
          <PlayerCard
            :player="player"
            :show-team-logo="false"
            :image-type="currentImageType"
            :clickable="true"
            @card-click="cycleImage"
            class="mb-4"
          />
          <div
            v-if="player.championships && player.championships > 0"
            class="flex gap-2 mb-2"
          >
            <img
              v-for="n in player.championships"
              :key="n"
              :src="cup"
              alt="Stanley Cup"
              class="w-10 h-10"
            />
          </div>
          <span class="text-lg"
            >Title Defenses: {{ player.titleDefenses }}</span
          >
          <span class="text-md" v-if="player.totalDefenses"
            >Lifetime Defenses: {{ player.totalDefenses }}</span
          >
        </v-card-text>
      </v-card>
      <v-card
        class="profile-section mt-5"
        data-test="player-profile-trend-panel"
      >
        <v-card-title>Trend Snapshot</v-card-title>
        <v-card-text>
          <p v-if="!playersGamesPlayed.length" class="text-sm">
            No trend data available yet for this player.
          </p>
          <div v-else class="w-full overflow-x-auto">
            <v-table>
              <tbody>
                <tr data-test="player-profile-trend-last10">
                  <td class="font-bold">Last 10</td>
                  <td class="text-center">{{ trendSummary.lastTen.record }}</td>
                  <td class="text-right">
                    Win% {{ formatWinPct(trendSummary.lastTen.winPct) }}
                  </td>
                </tr>
                <tr data-test="player-profile-trend-best-team">
                  <td class="font-bold">Best Team</td>
                  <td class="text-center">
                    {{
                      trendSummary.bestTeam
                        ? `${trendSummary.bestTeam.wins}-${trendSummary.bestTeam.losses}`
                        : 'N/A'
                    }}
                  </td>
                  <td class="text-right">
                    {{
                      trendSummary.bestTeam
                        ? `${trendSummary.bestTeam.team} (${formatWinPct(
                            trendSummary.bestTeam.winPct
                          )})`
                        : 'N/A'
                    }}
                  </td>
                </tr>
                <tr data-test="player-profile-trend-weakest-matchup">
                  <td class="font-bold">Weakest Matchup</td>
                  <td class="text-center">
                    {{
                      trendSummary.weakestMatchup
                        ? `${trendSummary.weakestMatchup.wins}-${trendSummary.weakestMatchup.losses}`
                        : 'N/A'
                    }}
                  </td>
                  <td class="text-right">
                    {{
                      trendSummary.weakestMatchup
                        ? `${trendSummary.weakestMatchup.team} (${formatWinPct(
                            trendSummary.weakestMatchup.winPct
                          )})`
                        : 'N/A'
                    }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-card>
      <div
        v-if="playersGamesPlayed.length"
        class="profile-section mt-5 grid gap-5"
      >
        <div class="w-full overflow-x-auto">
          <v-table>
            <thead>
              <tr>
                <th class="text-center font-bold">Match Up</th>
                <th class="text-center font-bold">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="game in displayedGames" :key="game.id" class="py-2">
                <td class="text-center flex gap-2 justify-center items-center">
                  <TeamLogo :team="game.wTeam" />
                  vs.
                  <TeamLogo :team="game.lTeam" />
                </td>

                <td class="text-center">
                  <div
                    class="text-center flex gap-2 justify-center items-center"
                  >
                    <TeamLogo
                      v-if="getResults(game).team"
                      :team="getResults(game).team"
                    />
                    <router-link
                      :to="{ name: 'GamePage', params: { id: game.id } }"
                    >
                      {{ getResults(game).result }}
                    </router-link>
                  </div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <v-btn
          v-if="displayedGames.length < playersGamesPlayed.length"
          @click="loadMore"
        >
          Load More
        </v-btn>
        <div class="w-full overflow-x-auto">
          <v-table>
            <thead>
              <tr>
                <th class="text-center">Team</th>
                <th class="text-center">Record</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="team in player.teams"
                :key="team"
                class="py-2 align-middle"
              >
                <td class="text-center">
                  <div class="flex justify-center items-center">
                    <TeamLogo :team="team" class="!w-10 !h-10" />
                  </div>
                </td>
                <td class="text-center">
                  {{ getWins(team) }} - {{ getLosses(team) }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </div>
      <p
        v-else
        class="profile-section text-sm mt-5 text-center"
        data-test="player-profile-no-games"
      >
        No game records yet for this player.
      </p>
    </div>
  </v-container>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { usePlayerSeasonData } from '@/composables/usePlayerSeasonData';
import {
  buildPlayerGameHistory,
  classifyPlayerGame,
  getPlayerProfileTrends,
} from '@/utilities/playerProfileTrends';

import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';
import cup from '@/assets/in-season-logo-season2.png';

const props = defineProps(['name']);

const {
  gameRecords,
  player: seasonPlayer,
  loading,
  error,
} = usePlayerSeasonData(props.name);

// Use the player from the composable
const player = seasonPlayer;
const playersGamesPlayed = ref([]);
const currentPage = ref(1);
const itemsPerPage = ref(5);
const displayedGames = ref([]);

const currentImageType = ref('Happy');

const imageTypes = ['Happy', 'Sad', 'Angry', 'Anguish'];

const profileErrorMessage = computed(() => {
  if (!error.value) return '';
  return 'Unable to load this player profile right now. Please try again shortly.';
});

const cycleImage = () => {
  const currentIndex = imageTypes.indexOf(currentImageType.value);
  const nextIndex = (currentIndex + 1) % imageTypes.length;
  currentImageType.value = imageTypes[nextIndex];
};

const loadMore = () => {
  if (!playersGamesPlayed.value) {
    return;
  }
  const start = displayedGames.value.length;
  const end = start + itemsPerPage.value;
  displayedGames.value = displayedGames.value.concat(
    playersGamesPlayed.value.slice(start, end)
  );
  currentPage.value++;
};

const formatWinPct = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${(value * 100).toFixed(1)}%`;
};

const trendSummary = computed(() =>
  getPlayerProfileTrends(playersGamesPlayed.value, player.value?.teams || [])
);

const getResults = (game) => {
  const result = classifyPlayerGame(game, player.value?.teams || []);

  if (result.classification === 'Mirror') {
    return { team: null, result: 'Mirror Match' };
  }

  if (result.classification === 'Loss') {
    return { team: result.playerTeam, result: 'Loss' };
  }

  if (result.classification === 'Win') {
    return { team: result.playerTeam, result: 'Win' };
  }

  return { team: null, result: 'Unknown' };
};

const teamStatsByTeam = computed(() => {
  const summary = new Map();
  const teams = Array.isArray(player.value?.teams) ? player.value.teams : [];

  teams.forEach((team) => {
    summary.set(team, { wins: 0, losses: 0 });
  });

  playersGamesPlayed.value.forEach((game) => {
    const result = classifyPlayerGame(game, teams);
    if (result.winnerTeam && summary.has(result.winnerTeam)) {
      summary.get(result.winnerTeam).wins += 1;
    }
    if (result.loserTeam && summary.has(result.loserTeam)) {
      summary.get(result.loserTeam).losses += 1;
    }
  });

  return summary;
});

const getWins = (team) => teamStatsByTeam.value.get(team)?.wins || 0;

const getLosses = (team) => teamStatsByTeam.value.get(team)?.losses || 0;

// Function to update player games when game records change
const updatePlayerGames = () => {
  if (gameRecords.value && gameRecords.value.length > 0 && player.value) {
    playersGamesPlayed.value = buildPlayerGameHistory(
      gameRecords.value,
      player.value?.teams || []
    );

    // Reset displayed games to show new data
    displayedGames.value = [];
    currentPage.value = 1;
    loadMore();
  } else {
    playersGamesPlayed.value = [];
    displayedGames.value = [];
    currentPage.value = 1;
  }
};

watch(
  [gameRecords, player],
  () => {
    updatePlayerGames();
  },
  { immediate: true }
);
</script>

<style scoped>
.profile-section {
  width: 100%;
  max-width: 64rem;
}
</style>
