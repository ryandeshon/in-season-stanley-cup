<template>
  <v-container class="max-w-screen-md min-h-32">
    <div v-if="player">
      <div class="flex flex-col justify-center items-center my-4">
        <div v-if="player">
          <v-card class="pb-3">
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
          <div v-if="playersGamesPlayed.length" class="mt-5 grid gap-5">
            <v-table>
              <thead>
                <tr>
                  <th class="text-center font-bold">Match Up</th>
                  <th class="text-center font-bold">Result</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="game in displayedGames" :key="game.id" class="py-2">
                  <td
                    class="text-center flex gap-2 justify-center items-center"
                  >
                    <TeamLogo :team="game.wTeam" />
                    vs.
                    <TeamLogo :team="game.lTeam" />
                  </td>

                  <td class="text-center">
                    <div
                      class="text-center flex gap-2 justify-center items-center"
                    >
                      <TeamLogo :team="getResults(game).team" />
                      <router-link
                        :to="{ name: 'GamePage', params: { id: game.id } }"
                        >{{ getResults(game).result }}</router-link
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-btn
              v-if="displayedGames.length < playersGamesPlayed.length"
              @click="loadMore"
            >
              Load More
            </v-btn>
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
        <div v-else class="flex justify-center items-center mt-10">
          <v-progress-circular
            indeterminate
            color="primary"
          ></v-progress-circular>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { usePlayerSeasonData } from '@/composables/usePlayerSeasonData';

import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';
import cup from '@/assets/in-season-logo-season2.png';

const props = defineProps(['name']);

const {
  gameRecords,
  player: seasonPlayer,
  // loading,
} = usePlayerSeasonData(props.name);

// Use the player from the composable
const player = seasonPlayer;
const playersGamesPlayed = ref([]);
const currentPage = ref(1);
const itemsPerPage = ref(5);
const displayedGames = ref([]);

const currentImageType = ref('Happy');

const imageTypes = ['Happy', 'Sad', 'Angry', 'Anguish'];

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

const getResults = (game) => {
  if (
    player.value.teams.includes(game.lTeam) &&
    player.value.teams.includes(game.wTeam)
  ) {
    return { team: null, result: 'Mirror Match' };
  }

  if (player.value.teams.includes(game.lTeam)) {
    return { team: game.lTeam, result: 'Loss' };
  } else if (player.value.teams.includes(game.wTeam)) {
    return { team: game.wTeam, result: 'Win' };
  }
  return { team: 'Unknown', result: 'Unknown' };
};

const getWins = (team) => {
  return playersGamesPlayed.value.filter((game) => game.wTeam === team).length;
};

const getLosses = (team) => {
  return playersGamesPlayed.value.filter((game) => game.lTeam === team).length;
};

// Function to update player games when game records change
const updatePlayerGames = () => {
  if (gameRecords.value && gameRecords.value.length > 0 && player.value) {
    const filteredGames = gameRecords.value.filter(
      (game) =>
        player.value.teams.includes(game.lTeam) ||
        player.value.teams.includes(game.wTeam)
    );

    playersGamesPlayed.value = filteredGames.sort((a, b) => b.id - a.id);

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
