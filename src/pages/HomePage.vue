<template>
  <v-container class="max-w-[570px] min-h-32">
    <h1
      class="text-4xl font-bold mb-4"
      :class="{ 'text-center': isSeasonOver }"
      data-test="home-title"
    >
      In Season Cup <span v-if="isSeasonOver">Champion</span>
    </h1>
    <v-alert
      v-if="homeErrorMessage"
      type="warning"
      variant="tonal"
      class="mb-4"
      data-test="home-warning"
    >
      {{ homeErrorMessage }}
    </v-alert>

    <template v-if="loading">
      <div class="flex justify-center items-center mt-4 h-40">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>
    </template>

    <template v-else>
      <SeasonChampion v-if="isSeasonOver" />

      <template v-else>
        <!-- Winner for tonight -->
        <template v-if="isGameOver">
          <div class="grid gap-4 grid-cols-2 justify-center items-start my-4">
            <div class="text-center">
              <h2 class="text-xl font-bold mb-2">Champion</h2>
              <p class="text-sm self-start">
                <em>"{{ getQuote() }}"</em>
              </p>
            </div>
            <div class="text-center">
              <h2 class="text-xl font-bold mb-2">Game Over</h2>
              <div>
                Final Score: {{ todaysWinner.score }} - {{ todaysLoser.score }}
              </div>
              <div>
                Winner:
                <strong>{{ todaysWinner.player?.name || 'Unknown' }}</strong> -
                {{ todaysWinner.commonName.default }}
              </div>
            </div>
          </div>

          <div
            class="grid gap-4 grid-cols-2 justify-start items-start w-full my-4"
          >
            <PlayerCard
              :player="todaysWinner.player"
              :team="todaysWinner"
              :image-type="gameOverWinnerAvatarType"
              :is-game-live="isGameLive"
            />
            <PlayerCard
              :player="todaysLoser.player"
              :team="todaysLoser"
              :image-type="gameOverLoserAvatarType"
              :is-game-live="isGameLive"
            />
          </div>
        </template>

        <!-- Game day -->
        <template v-else-if="isGameToday">
          <div v-if="isGameLive" class="text-center">
            <div>
              Period: {{ todaysGame.clock.inIntermission ? 'INT' : period }}
            </div>
            <div>Time Remaining: {{ clockTime }}</div>
          </div>
          <div v-else class="text-center">
            <h3 class="text-xl font-bold">Game Information</h3>
            <p>{{ localStartTime }}</p>
          </div>
          <div v-if="isMirrorMatch" class="text-center">
            <h2 class="text-xl font-bold mb-2">Mirror Match</h2>
          </div>
          <div
            class="flex flex-row gap-4 justify-center items-center w-full my-4"
          >
            <div
              class="rounded-lg p-1 transition-colors"
              :class="{
                'cursor-pointer hover:bg-black/5': true,
                'bg-black/10': selectedWinnerRole === 'champion',
              }"
              data-test="champion-select-card"
            >
              <div class="text-center font-bold text-xl mb-2">Champion</div>
              <PlayerCard
                :player="playerChampion"
                :team="playerChampion.championTeam"
                :image-type="championAvatarType"
                :is-game-live="isGameLive"
                :is-champion="true"
                :clickable="true"
                @card-click="handleWinnerSelection('champion')"
              />
            </div>
            <div class="flex justify-center items-center">
              <strong>VS</strong>
            </div>
            <div
              class="rounded-lg p-1 transition-colors"
              :class="{
                'cursor-pointer hover:bg-black/5': true,
                'bg-black/10': selectedWinnerRole === 'challenger',
              }"
              data-test="challenger-select-card"
            >
              <div class="text-center font-bold text-xl mb-2">Challenger</div>
              <PlayerCard
                :player="playerChallenger"
                :team="playerChallenger.challengerTeam"
                :image-type="challengerAvatarType"
                :is-game-live="isGameLive"
                :is-mirror-match="isMirrorMatch"
                :clickable="true"
                @card-click="handleWinnerSelection('challenger')"
              />
            </div>
          </div>
          <div class="text-center mb-4">
            <router-link
              :to="`/game/${todaysGame.id}`"
              class="text-blue-500 underline"
              data-test="view-game-details-link"
              >View Game Details</router-link
            >
          </div>
          <div
            v-if="selectedWinnerRole"
            class="text-center mb-4"
            data-test="conditional-matchups-section"
          >
            <h2 class="text-xl font-bold">{{ conditionalMatchupsHeading }}</h2>
            <template v-if="conditionalMatchupsLoading">
              <div class="flex justify-center items-center mt-4 h-20">
                <v-progress-circular
                  indeterminate
                  color="primary"
                ></v-progress-circular>
              </div>
            </template>
            <template v-else-if="conditionalMatchups.length">
              <v-table class="mt-4">
                <thead>
                  <tr>
                    <th class="text-center"><strong>Date</strong></th>
                    <th class="text-center"><strong>Home Team</strong></th>
                    <th class="text-center"></th>
                    <th class="text-center"><strong>Away Team</strong></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="game in conditionalMatchups"
                    :key="game.id"
                    class="py-2"
                    data-test="conditional-matchup-row"
                  >
                    <td class="text-center">{{ game.dateTime }}</td>
                    <td>
                      <div
                        class="flex flex-col-reverse sm:flex-row sm:gap-2 justify-center items-center"
                      >
                        <router-link
                          :to="`/player/${getTeamOwnerName(game.homeTeam.abbrev)}`"
                          >{{ getTeamOwnerName(game.homeTeam.abbrev) }}
                        </router-link>
                        <TeamLogo
                          :team="game.homeTeam.abbrev"
                          width="50"
                          height="50"
                        />
                      </div>
                    </td>
                    <td class="">vs</td>
                    <td>
                      <div
                        class="flex flex-col sm:flex-row sm:gap-2 justify-center items-center"
                      >
                        <TeamLogo
                          :team="game.awayTeam.abbrev"
                          width="50"
                          height="50"
                        />
                        <router-link
                          :to="`/player/${getTeamOwnerName(game.awayTeam.abbrev)}`"
                          >{{ getTeamOwnerName(game.awayTeam.abbrev) }}
                        </router-link>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </template>
            <p v-else class="mt-2" data-test="conditional-matchups-empty">
              No possible matchups for this winner this week.
            </p>
          </div>
        </template>

        <!-- Champion is not defending -->
        <template v-else>
          <div class="flex flex-col justify-center items-center my-4">
            <div class="text-center font-bold text-xl mb-2">Champion</div>
            <PlayerCard
              v-if="playerChampion?.name"
              :player="playerChampion"
              :current-champion="currentChampion"
              subtitle="is not Defending the Championship Today"
              image-type="Happy"
            />
            <p v-else class="text-sm mb-0" data-test="champion-team-fallback">
              Current champion team:
              <strong>{{ currentChampion || 'Unknown' }}</strong>
              (owner unavailable)
            </p>
          </div>
        </template>

        <div
          v-if="showDefenseOutlookPanel"
          class="text-center mb-4"
          data-test="whats-next-panel"
        >
          <h2 class="text-xl font-bold">What's Next</h2>
          <p class="text-sm mb-2">Possible Upcoming Match-ups</p>
          <template v-if="potentialLoading">
            <div
              class="flex justify-center items-center mt-4 h-40"
              data-test="whats-next-loading"
            >
              <v-progress-circular
                indeterminate
                color="primary"
              ></v-progress-circular>
            </div>
          </template>
          <p
            v-else-if="possibleMatchupsError"
            data-test="whats-next-error"
            class="text-sm"
          >
            {{ possibleMatchupsError }}
          </p>
          <v-table v-else-if="possibleMatchUps.length" class="mt-4">
            <thead>
              <tr>
                <th class="text-center"><strong>Date</strong></th>
                <th class="text-center"><strong>Home Team</strong></th>
                <th class="text-center"></th>
                <th class="text-center"><strong>Away Team</strong></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="game in possibleMatchUps"
                :key="game.id"
                class="py-2"
                data-test="whats-next-row"
              >
                <td class="text-center">{{ game.dateTime }}</td>
                <td>
                  <div
                    class="flex flex-col-reverse sm:flex-row sm:gap-2 justify-center items-center"
                  >
                    <router-link
                      :to="`/player/${getTeamOwnerName(game.homeTeam.abbrev)}`"
                      >{{ getTeamOwnerName(game.homeTeam.abbrev) }}
                    </router-link>
                    <TeamLogo
                      :team="game.homeTeam.abbrev"
                      width="50"
                      height="50"
                    />
                  </div>
                </td>
                <td class="">vs</td>
                <td>
                  <div
                    class="flex flex-col sm:flex-row sm:gap-2 justify-center items-center"
                  >
                    <TeamLogo
                      :team="game.awayTeam.abbrev"
                      width="50"
                      height="50"
                    />
                    <router-link
                      :to="`/player/${getTeamOwnerName(game.awayTeam.abbrev)}`"
                      >{{ getTeamOwnerName(game.awayTeam.abbrev) }}
                    </router-link>
                  </div>
                </td>
              </tr>
            </tbody>
          </v-table>
          <p v-else data-test="whats-next-empty" class="text-sm">
            No next-defense games are scheduled this week.
          </p>
        </div>
      </template>

      <ChampionTimeline
        :entries="championHistory"
        :streak="championStreak"
        :loading="championHistoryLoading"
        :error="championHistoryError"
        :has-more="championHistoryHasMore"
        root-data-test="champion-timeline"
        test-prefix="champion-history"
        @load-more="loadMoreChampionHistory"
      />
    </template>
  </v-container>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useCurrentSeasonData } from '@/composables/useCurrentSeasonData';
import { useCupGameState } from '@/composables/useCupGameState';
import { useLiveGameFeed } from '@/composables/useLiveGameFeed';
import { useUpcomingMatchups } from '@/composables/useUpcomingMatchups';
import { useChampionTimeline } from '@/composables/useChampionTimeline';
import { useSeasonStore } from '@/store/seasonStore';
import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';
import ChampionTimeline from '@/components/ChampionTimeline.vue';
import SeasonChampion from '@/pages/SeasonChampion.vue';

const { players: allPlayersData, error: seasonDataError } =
  useCurrentSeasonData();
const seasonStore = useSeasonStore();

const playersList = computed(() =>
  Array.isArray(allPlayersData.value) ? allPlayersData.value : []
);

function findPlayerByTeam(teamAbbrev) {
  if (!teamAbbrev) return undefined;
  return playersList.value.find(
    (player) =>
      Array.isArray(player?.teams) && player.teams.includes(teamAbbrev)
  );
}

function getTeamOwner(teamAbbrev) {
  return findPlayerByTeam(teamAbbrev);
}

function getTeamOwnerName(teamAbbrev) {
  return getTeamOwner(teamAbbrev)?.name || 'Unknown';
}

const cupGameState = useCupGameState({ findPlayerByTeam });
const {
  loading,
  homeError,
  currentChampion,
  localStartTime,
  todaysGame,
  todaysWinner,
  todaysLoser,
  playerChampion,
  playerChallenger,
  isGameToday,
  isGameOver,
  isGameLive,
  isSeasonOver,
  isMirrorMatch,
  gameID,
  cupGameId,
  selectedGameId,
  lastLiveUpdateAt,
  clockTime,
  period,
  championAvatarType,
  challengerAvatarType,
  gameOverWinnerAvatarType,
  gameOverLoserAvatarType,
  seasonMetaWarning,
  setLifecycleHandlers,
  refreshSeasonMeta,
  refreshChampionAndGameState,
  getGameInfo,
  getQuote,
  applyGameUpdate,
} = cupGameState;

const upcomingMatchups = useUpcomingMatchups({
  todaysGame,
  todaysWinner,
  cupGameId,
  selectedGameId,
  playerChampion,
  playerChallenger,
  findPlayerByTeam,
});
const {
  potentialLoading,
  possibleMatchUps,
  possibleMatchupsError,
  matchupOptions,
  selectedWinnerRole,
  conditionalMatchups,
  conditionalMatchupsLoading,
  conditionalMatchupsHeading,
  loadMatchupOptions,
  resetConditionalMatchups,
  handleWinnerSelection,
  getPossibleMatchUps,
} = upcomingMatchups;

const {
  visibleEntries: championHistory,
  streak: championStreak,
  loading: championHistoryLoading,
  error: championHistoryError,
  warning: contractWarning,
  hasMore: championHistoryHasMore,
  load: loadChampionHistory,
  loadMore: loadMoreChampionHistory,
} = useChampionTimeline({
  season: computed(() => seasonStore.currentSeason),
  ownerResolver: getTeamOwnerName,
  pageSize: 6,
  fetchLimit: 200,
  warningSessionKey: 'home-champion-history-contract-warning',
});

const liveGameFeed = useLiveGameFeed({
  cupGameId,
  selectedGameId,
  isGameToday,
  isGameOver,
  lastLiveUpdateAt,
  getGameInfo,
  applyGameUpdate,
  refreshChampionAndGameState,
});
const {
  initLiveFeed,
  startPolling,
  stopPolling,
  startChampionRefresh,
  setupVisibilityRefresh,
} = liveGameFeed;

setLifecycleHandlers({
  onChampionNotPlaying: ({ currentChampionAbbrev, gameData }) => {
    resetConditionalMatchups();
    potentialLoading.value = true;
    getPossibleMatchUps(currentChampionAbbrev, {
      referenceDate: gameData?.startTimeUTC,
    });
    stopPolling();
  },
  onGameOver: ({ winnerTeamAbbrev, gameData }) => {
    resetConditionalMatchups();
    potentialLoading.value = true;
    getPossibleMatchUps(winnerTeamAbbrev, {
      referenceDate: gameData?.startTimeUTC,
    });
    stopPolling();
  },
  onGameInProgress: () => {
    startPolling();
  },
});

const showDefenseOutlookPanel = computed(
  () => !isSeasonOver.value && (isGameOver.value || !isGameToday.value)
);

const homeErrorMessage = computed(() => {
  if (homeError.value) return homeError.value;
  if (seasonMetaWarning.value) return seasonMetaWarning.value;
  if (contractWarning.value) return contractWarning.value;
  if (seasonDataError.value) {
    return 'Player data is unavailable right now. Team owners may appear as Unknown.';
  }
  return '';
});

onMounted(async () => {
  await refreshSeasonMeta();
  await loadChampionHistory();

  if (isSeasonOver.value) {
    loading.value = false;
    return;
  }

  try {
    await refreshChampionAndGameState();
  } catch (error) {
    console.error('Error fetching getCurrentChampion or getGameId:', error);
  }
  startChampionRefresh();
  setupVisibilityRefresh();

  isGameToday.value = gameID.value !== null;
  if (isGameToday.value) {
    await getGameInfo(cupGameId.value);
    await loadMatchupOptions();
    initLiveFeed();
    startPolling();
  } else {
    matchupOptions.value = [];
    playerChampion.value = findPlayerByTeam(currentChampion.value) || {};
    getPossibleMatchUps(currentChampion.value);
    loading.value = false;
  }
});
</script>

<style></style>
