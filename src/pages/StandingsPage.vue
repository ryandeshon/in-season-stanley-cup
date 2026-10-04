<template>
  <v-container class="max-w-screen-md">
    <p v-if="arcade" class="page-eyebrow">SEASON 03 / THE RANKING BOARD</p>
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
      <div class="standings-table-shell overflow-x-auto">
        <v-table class="compact-mobile-table">
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
                <div class="standing-identity">
                  <router-link
                    class="standing-player"
                    :to="`/player/${standing.name}`"
                    ><img
                      v-if="arcade && characters[standing.name]"
                      :src="characters[standing.name].portrait"
                      alt=""
                      class="rank-portrait"
                    /><span>{{ standing.name }}</span></router-link
                  >
                  <img
                    v-if="standing.name === currentChampion?.name"
                    :src="arcade ? championBadge : Crown"
                    alt="Current champion"
                    class="standing-champion"
                  />
                </div>
              </td>
              <td class="align-top">
                <div
                  class="flex flex-wrap justify-center items-start gap-1 py-2"
                >
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
      </div>
      <div class="text-sm my-2">
        <img
          :src="arcade ? championBadge : Crown"
          alt="Current champion"
          class="inline w-8 h-8 mr-1"
        />
        = Current Champion
      </div>
    </div>
    <template v-if="seasonProgressPercentage !== null">
      <h2 class="text-center text-xl font-bold">Season Progress</h2>
      <v-progress-linear
        :model-value="seasonProgressPercentage"
        data-test="season-progress"
        color="primary"
        height="20"
        class="my-4"
      >
        <template v-slot:default="{ value }">
          <strong>{{ Math.ceil(value) }}%</strong>
        </template>
      </v-progress-linear>
      <div class="text-center text-sm">
        <span>{{ daysRemainingLabel }}</span>
      </div>
    </template>

    <v-alert
      v-if="timelineWarning"
      type="warning"
      variant="tonal"
      class="mt-4"
      data-test="standings-timeline-warning"
    >
      {{ timelineWarning }}
    </v-alert>

    <ChampionTimeline
      :entries="timelineEntries"
      :streak="timelineStreak"
      :loading="timelineLoading"
      :error="timelineError"
      :has-more="timelineHasMore"
      root-data-test="standings-champion-timeline"
      test-prefix="standings-champion-history"
      @load-more="loadMoreTimeline"
    />
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { seasonProgress } from '@/utilities/seasonProgress';
import { useSeasonData } from '@/composables/useSeasonData';
import { useChampionTimeline } from '@/composables/useChampionTimeline';
import { getCurrentChampion } from '@/services/championServices';
import { characters } from '@/utilities/arcadeAssets';
import { useSeasonStore } from '@/store/seasonStore';
import TeamLogo from '@/components/TeamLogo.vue';
import ChampionTimeline from '@/components/ChampionTimeline.vue';
import championBadge from '@/assets/arcade/icons/current-champion.svg';
import Crown from '@/assets/crown.png';

const seasonStore = useSeasonStore();
const arcade = computed(() => seasonStore.currentSeason === 'season3');
const { players, gameRecords, loading } = useSeasonData();
const currentChampion = ref(null);

function getTeamOwnerName(teamAbbrev) {
  const matched = players.value?.find((player) =>
    Array.isArray(player?.teams) ? player.teams.includes(teamAbbrev) : false
  );
  return matched?.name || 'Unknown';
}

const {
  visibleEntries: timelineEntries,
  streak: timelineStreak,
  loading: timelineLoading,
  error: timelineError,
  warning: timelineWarning,
  hasMore: timelineHasMore,
  load: loadTimeline,
  loadMore: loadMoreTimeline,
} = useChampionTimeline({
  season: computed(() => seasonStore.currentSeason),
  ownerResolver: getTeamOwnerName,
  pageSize: 6,
  fetchLimit: 200,
  warningSessionKey: 'standings-champion-history-contract-warning',
});

// Computed property for sorted players data
const allPlayersData = computed(() => {
  if (!players.value) return [];
  return [...players.value].sort((a, b) => b.titleDefenses - a.titleDefenses);
});

// Computed properties for game statistics
const totalGamesPlayed = computed(() => gameRecords.value?.length || 0);

const progress = computed(() => seasonProgress(seasonStore.selectedSeason));
const seasonProgressPercentage = computed(
  () => progress.value?.percentage ?? null
);
const daysRemainingLabel = computed(() => {
  const p = progress.value;
  if (!p) return `${totalGamesPlayed.value} games tracked`;
  return `${p.daysRemaining} days left (${p.startLabel} to ${p.endLabel}) • ${totalGamesPlayed.value} games tracked`;
});

// Function to update current champion when data changes
const updateCurrentChampion = async () => {
  if (!players.value?.length) return;

  try {
    const currentChampionTeam = await getCurrentChampion({
      season: seasonStore.currentSeason,
    });
    currentChampion.value = players.value.find((player) =>
      player.teams.includes(currentChampionTeam)
    );
  } catch (error) {
    console.error('Error fetching current champion:', error);
  }
};

watch(
  players,
  (newPlayers) => {
    if (newPlayers?.length > 0) {
      updateCurrentChampion();
    }
  },
  { immediate: true }
);

onMounted(() => {
  loadTimeline();
});
</script>

<style scoped>
.standings-table-shell {
  border-radius: var(--border-radius);
  overflow: hidden;
}
.standing-identity,
.standing-player {
  display: flex;
  align-items: center;
  gap: 8px;
}
.standing-player .rank-portrait {
  flex: 0 0 auto;
  margin: 0;
}
.standing-champion {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex: 0 0 auto;
}
@media (max-width: 600px) {
  .standing-identity,
  .standing-player {
    flex-direction: column;
    justify-content: center;
    text-align: center;
    gap: 6px;
  }
  .standing-player .rank-portrait {
    width: 40px;
    height: 40px;
  }
  .standing-champion {
    width: 30px;
    height: 30px;
  }
}
</style>
