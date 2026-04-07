<template>
  <v-container class="max-w-screen-md min-h-32 px-4 sm:px-6">
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
          <div v-else class="trend-table w-full overflow-x-auto">
            <v-table>
              <tbody>
                <tr data-test="player-profile-trend-last10">
                  <td class="font-bold trend-row-label">Last 10</td>
                  <td class="text-center trend-row-record">
                    {{ trendSummary.lastTen.record }}
                  </td>
                  <td class="text-right trend-row-detail">
                    Win% {{ formatWinPct(trendSummary.lastTen.winPct) }}
                  </td>
                </tr>
                <tr data-test="player-profile-trend-best-team">
                  <td class="font-bold trend-row-label">Best Team</td>
                  <td class="text-center trend-row-record">
                    {{
                      trendSummary.bestTeam
                        ? `${trendSummary.bestTeam.wins}-${trendSummary.bestTeam.losses}`
                        : 'N/A'
                    }}
                  </td>
                  <td class="text-right trend-row-detail">
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
                  <td class="font-bold trend-row-label">Weakest Matchup</td>
                  <td class="text-center trend-row-record">
                    {{
                      trendSummary.weakestMatchup
                        ? `${trendSummary.weakestMatchup.wins}-${trendSummary.weakestMatchup.losses}`
                        : 'N/A'
                    }}
                  </td>
                  <td class="text-right trend-row-detail">
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
      <div class="profile-section mt-5 grid gap-5">
        <div
          v-if="playersGamesPlayed.length"
          class="profile-table-shell w-full overflow-x-auto"
          data-test="player-profile-history-panel"
        >
          <v-table>
            <thead>
              <tr>
                <th class="text-center font-bold">Match Up</th>
                <th class="text-center font-bold">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="game in displayedGames" :key="game.id" class="py-2">
                <td class="text-center">
                  <div
                    class="matchup-cell flex gap-2 justify-center items-center"
                  >
                    <TeamLogo :team="game.wTeam" />
                    vs.
                    <TeamLogo :team="game.lTeam" />
                  </div>
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
        <p
          v-else
          class="profile-section text-sm text-center"
          data-test="player-profile-no-games"
        >
          No game records yet for this player.
        </p>
        <v-btn v-if="canLoadMore" @click="loadMore"> Load More </v-btn>
        <div
          class="profile-table-shell w-full overflow-x-auto"
          data-test="player-profile-head-to-head-panel"
        >
          <v-table>
            <thead>
              <tr>
                <th class="text-center">Head-to-Head</th>
                <th class="text-center">Record</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="summary in headToHeadRows"
                :key="summary.opponentName"
                class="py-2 align-middle"
                :data-test="`player-profile-head-to-head-row-${summary.opponentName.toLowerCase()}`"
              >
                <td class="text-center">
                  <div class="flex justify-center items-center">
                    <img
                      v-if="summary.avatarSrc"
                      :src="summary.avatarSrc"
                      :alt="`${summary.opponentName} ${summary.avatarType} avatar`"
                      class="head-to-head-avatar"
                    />
                    <div v-else class="head-to-head-avatar-fallback">
                      {{ summary.opponentName.charAt(0) }}
                    </div>
                  </div>
                </td>
                <td class="text-center">
                  {{ summary.wins }} - {{ summary.losses }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <div
          class="profile-table-shell w-full overflow-x-auto"
          data-test="player-profile-team-records-panel"
        >
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
    </div>
  </v-container>
</template>

<script setup>
import { ref, watch, computed, unref } from 'vue';
import { usePlayerSeasonData } from '@/composables/usePlayerSeasonData';
import {
  buildHeadToHeadSummaries,
  buildPlayerGameHistory,
  classifyPlayerGame,
  getPlayerProfileTrends,
} from '@/utilities/playerProfileTrends';

import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';
import cup from '@/assets/in-season-logo-season2.png';
import bozAngryImageS1 from '@/assets/players/season1/boz-angry.png';
import bozSadImageS1 from '@/assets/players/season1/boz-sad.png';
import bozHappyImageS1 from '@/assets/players/season1/boz-happy.png';
import cooperAngryImageS1 from '@/assets/players/season1/cooper-angry.png';
import cooperSadImageS1 from '@/assets/players/season1/cooper-sad.png';
import cooperHappyImageS1 from '@/assets/players/season1/cooper-happy.png';
import ryanAngryImageS1 from '@/assets/players/season1/ryan-angry.png';
import ryanSadImageS1 from '@/assets/players/season1/ryan-sad.png';
import ryanHappyImageS1 from '@/assets/players/season1/ryan-happy.png';
import terryAngryImageS1 from '@/assets/players/season1/terry-angry.png';
import terrySadImageS1 from '@/assets/players/season1/terry-sad.png';
import terryHappyImageS1 from '@/assets/players/season1/terry-happy.png';
import bozAngryImageS2 from '@/assets/players/season2/boz-angry.png';
import bozSadImageS2 from '@/assets/players/season2/boz-sad.png';
import bozHappyImageS2 from '@/assets/players/season2/boz-happy.png';
import cooperAngryImageS2 from '@/assets/players/season2/cooper-angry.png';
import cooperSadImageS2 from '@/assets/players/season2/cooper-sad.png';
import cooperHappyImageS2 from '@/assets/players/season2/cooper-happy.png';
import ryanAngryImageS2 from '@/assets/players/season2/ryan-angry.png';
import ryanSadImageS2 from '@/assets/players/season2/ryan-sad.png';
import ryanHappyImageS2 from '@/assets/players/season2/ryan-happy.png';
import terryAngryImageS2 from '@/assets/players/season2/terry-angry.png';
import terrySadImageS2 from '@/assets/players/season2/terry-sad.png';
import terryHappyImageS2 from '@/assets/players/season2/terry-happy.png';

const props = defineProps(['name']);

const {
  gameRecords,
  players: seasonPlayers,
  player: seasonPlayer,
  loading,
  error,
  currentSeason,
} = usePlayerSeasonData(props.name);

// Use the player from the composable
const player = seasonPlayer;
const players = seasonPlayers;
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

const headToHeadSummaries = computed(() =>
  buildHeadToHeadSummaries({
    gameRecords: gameRecords.value,
    profilePlayerName: player.value?.name,
    players: players.value,
  })
);

const playerImages = {
  season1: {
    Boz: {
      Happy: bozHappyImageS1,
      Angry: bozAngryImageS1,
      Sad: bozSadImageS1,
    },
    Terry: {
      Happy: terryHappyImageS1,
      Angry: terryAngryImageS1,
      Sad: terrySadImageS1,
    },
    Cooper: {
      Happy: cooperHappyImageS1,
      Angry: cooperAngryImageS1,
      Sad: cooperSadImageS1,
    },
    Ryan: {
      Happy: ryanHappyImageS1,
      Angry: ryanAngryImageS1,
      Sad: ryanSadImageS1,
    },
  },
  season2: {
    Boz: {
      Happy: bozHappyImageS2,
      Angry: bozAngryImageS2,
      Sad: bozSadImageS2,
    },
    Terry: {
      Happy: terryHappyImageS2,
      Angry: terryAngryImageS2,
      Sad: terrySadImageS2,
    },
    Cooper: {
      Happy: cooperHappyImageS2,
      Angry: cooperAngryImageS2,
      Sad: cooperSadImageS2,
    },
    Ryan: {
      Happy: ryanHappyImageS2,
      Angry: ryanAngryImageS2,
      Sad: ryanSadImageS2,
    },
  },
};

const currentSeasonKey = computed(() =>
  unref(currentSeason) === 'season1' ? 'season1' : 'season2'
);

const getHeadToHeadAvatar = (opponentName, imageType) =>
  playerImages[currentSeasonKey.value]?.[opponentName]?.[imageType] || null;

const headToHeadRows = computed(() =>
  headToHeadSummaries.value.map((summary) => ({
    ...summary,
    avatarSrc: getHeadToHeadAvatar(summary.opponentName, summary.avatarType),
  }))
);

const canLoadMore = computed(
  () =>
    playersGamesPlayed.value.length &&
    displayedGames.value.length < playersGamesPlayed.value.length
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

.profile-table-shell {
  border-radius: var(--border-radius);
  overflow: hidden;
}

.head-to-head-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  object-fit: contain;
}

.head-to-head-avatar-fallback {
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  border: 1px solid rgba(107, 114, 128, 0.4);
}

.trend-table :deep(table) {
  width: 100%;
  table-layout: fixed;
}

.trend-row-label {
  width: 40%;
}

.trend-row-record {
  width: 20%;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.trend-row-detail {
  width: 40%;
}

@media (max-width: 640px) {
  .trend-table :deep(th),
  .trend-table :deep(td),
  .profile-table-shell :deep(th),
  .profile-table-shell :deep(td) {
    padding: 0.55rem 0.4rem;
  }

  .trend-row-label {
    width: 34%;
  }

  .trend-row-record {
    width: 22%;
  }

  .trend-row-detail {
    width: 44%;
    font-size: 0.95rem;
    line-height: 1.2;
  }

  .matchup-cell {
    gap: 0.35rem;
  }
}
</style>
