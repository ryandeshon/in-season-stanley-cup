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
      <div class="standings-table-shell overflow-x-auto">
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
                  v-if="standing.name === currentChampion?.name"
                  :src="Crown"
                  alt="Crown"
                  class="inline ml-1 w-8 h-8"
                />
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
        <img :src="Crown" alt="Crown" class="inline w-8 h-8 mr-1" /> = Current
        Champion
      </div>
    </div>
    <template v-if="totalGamesPlayed && seasonProgressPercentage !== null">
      <h2 class="text-center text-xl font-bold">Season Progress</h2>
      <v-progress-linear
        v-model="seasonProgressPercentage"
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
import { useSeasonData } from '@/composables/useSeasonData';
import { useChampionTimeline } from '@/composables/useChampionTimeline';
import { getCurrentChampion } from '@/services/championServices';
import { useSeasonStore } from '@/store/seasonStore';
import TeamLogo from '@/components/TeamLogo.vue';
import ChampionTimeline from '@/components/ChampionTimeline.vue';
import Crown from '@/assets/crown.png';

const seasonStore = useSeasonStore();
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

function getRecordTimestamp(record) {
  const candidates = [
    record?.savedAt,
    record?.recordedAt,
    record?.finalizedAt,
    record?.updatedAt,
    record?.createdAt,
  ];

  for (const candidate of candidates) {
    const parsed = Date.parse(candidate || '');
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

const seasonStartDate = computed(() => {
  if (!Array.isArray(gameRecords.value) || gameRecords.value.length === 0) {
    return null;
  }

  let earliest = null;
  gameRecords.value.forEach((record) => {
    const ts = getRecordTimestamp(record);
    if (ts === null) return;
    if (earliest === null || ts < earliest) {
      earliest = ts;
    }
  });

  return earliest === null ? null : new Date(earliest);
});

const seasonEndDate = computed(() => {
  if (!seasonStartDate.value) return null;
  const startYear = seasonStartDate.value.getUTCFullYear();
  return new Date(Date.UTC(startYear + 1, 3, 16, 23, 59, 59, 999));
});

const seasonProgressPercentage = computed(() => {
  if (!seasonStartDate.value || !seasonEndDate.value) return null;

  const start = seasonStartDate.value.getTime();
  const end = seasonEndDate.value.getTime();
  const now = Date.now();
  if (end <= start) return null;
  if (now <= start) return 0;
  if (now >= end) return 100;

  return ((now - start) / (end - start)) * 100;
});

const daysRemaining = computed(() => {
  if (!seasonEndDate.value) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(
    0,
    Math.ceil((seasonEndDate.value.getTime() - Date.now()) / msPerDay)
  );
});

function formatMonthDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
  });
}

const daysRemainingLabel = computed(() => {
  if (!seasonStartDate.value || !seasonEndDate.value) {
    return `${totalGamesPlayed.value} games tracked`;
  }
  return `${daysRemaining.value} days left (${formatMonthDay(
    seasonStartDate.value
  )} to ${formatMonthDay(seasonEndDate.value)}) • ${totalGamesPlayed.value} games tracked`;
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
</style>
