<template>
  <v-container class="max-w-[570px] min-h-32">
    <h1
      class="text-4xl font-bold mb-4"
      :class="{ 'text-center': isSeasonOver }"
      data-test="home-title"
    >
      In Season Cup <span v-if="isSeasonOver">Champion</span>
    </h1>
    <template v-if="loading">
      <div class="flex justify-center items-center mt-4 h-40">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>
    </template>

    <SeasonChampion v-else-if="isSeasonOver" />

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
              Winner: <strong>{{ todaysWinner.player.name }}</strong> -
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
          <div>
            <PlayerCard
              :player="todaysLoser.player"
              :team="todaysLoser"
              :image-type="gameOverLoserAvatarType"
              :is-game-live="isGameLive"
            />
            <div v-if="firstGameNonChampionTeam" class="next-game-info mt-2">
              <p class="text-lg font-bold mb-1">Next Game:</p>
              <p class="">
                {{ firstGameNonChampionTeam.date }}
              </p>
              <PlayerCard
                :player="firstGameNonChampionTeam.player"
                :team="firstGameNonChampionTeam.team"
                image-type="Angry"
              />
            </div>
          </div>
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
            :player="playerChampion"
            :current-champion="currentChampion"
            subtitle="is not Defending the Championship Today"
            image-type="Happy"
          />
        </div>

        <template v-if="potentialLoading">
          <div class="flex justify-center items-center mt-4 h-40">
            <v-progress-circular
              indeterminate
              color="primary"
            ></v-progress-circular>
          </div>
        </template>
        <div v-else class="text-center mb-4">
          <h2 class="text-xl font-bold">Possible Upcoming Match-ups</h2>
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
              <tr v-for="game in possibleMatchUps" :key="game.id" class="py-2">
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
        </div>
      </template>
    </template>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { DateTime } from 'luxon';
import nhlApi from '../services/nhlApi';
import { useCurrentSeasonData } from '@/composables/useCurrentSeasonData';
import { getCurrentChampion, getGameId } from '../services/championServices';
import { initSocket, useSocket } from '@/services/socketClient';
import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';
import SeasonChampion from '@/pages/SeasonChampion.vue';

import quotes from '@/utilities/quotes.json';

const { players: allPlayersData } = useCurrentSeasonData();
const loading = ref(true);
const potentialLoading = ref(true);
const currentChampion = ref(null);
const localStartTime = ref(null);
const todaysGame = ref({});
const todaysWinner = ref({});
const todaysLoser = ref({});
const playerChampion = ref({});
const playerChallenger = ref({});
const possibleMatchUps = ref([]);
const secondsRemaining = ref(null);
const isGameToday = ref(false);
const isGameOver = ref(false);
const isGameLive = ref(false);
const isSeasonOver = ref(false);
const isMirrorMatch = ref(false);
const gameID = ref(null);
const cupGameId = ref(null);
const selectedGameId = ref(null);
const matchupOptions = ref([]);
const matchupOptionsLoading = ref(false);
const selectedWinnerRole = ref('');
const conditionalMatchups = ref([]);
const conditionalMatchupsLoading = ref(false);
let conditionalMatchupsRequestId = 0;
const lastLiveUpdateAt = ref(0);
let pollIntervalId = null;
const POLL_INTERVAL_MS = 30000;
const CHAMPION_REFRESH_MS = 5 * 60 * 1000;
let championRefreshIntervalId = null;
let visibilityHandlerBound = null;
// Add new reactive state for avatar management
const previousHomeScore = ref(0);
const previousAwayScore = ref(0);
const recentGoalAgainst = ref({ home: false, away: false });
const goalTimers = ref({ home: null, away: null });

// WebSocket
const { lastMessage, isConnected } = useSocket();
const isDisconnected = ref(false);
watch(
  isConnected,
  (newVal) => {
    isDisconnected.value = !newVal;
  },
  { immediate: true }
);

const clockTime = computed(() => {
  if (secondsRemaining.value === null || secondsRemaining.value === undefined) {
    return '--:--';
  }
  return DateTime.fromSeconds(secondsRemaining.value).toFormat('mm:ss');
});

const period = computed(() => {
  if (todaysGame.value.periodDescriptor?.periodType === 'OT') {
    return 'OT';
  }
  return todaysGame.value.periodDescriptor?.number;
});

const firstGameNonChampionTeam = computed(() => {
  if (possibleMatchUps.value.length === 0) {
    return null;
  }
  const firstGame = possibleMatchUps.value[0];
  const nonChampionTeam =
    firstGame.homeTeam.abbrev === todaysWinner.value.abbrev
      ? firstGame.awayTeam
      : firstGame.homeTeam;
  const player = allPlayersData.value.find((player) =>
    player.teams.includes(nonChampionTeam.abbrev)
  );
  return {
    date: firstGame.dateTime,
    team: nonChampionTeam,
    player: player,
  };
});

// Add computed properties for dynamic avatars
const championAvatarType = computed(() => {
  if (!isGameLive.value) {
    return 'Happy';
  }

  const isChampionHome =
    currentChampion.value === todaysGame.value.homeTeam?.abbrev;
  const championScore = isChampionHome
    ? todaysGame.value.homeTeam?.score
    : todaysGame.value.awayTeam?.score;
  const challengerScore = isChampionHome
    ? todaysGame.value.awayTeam?.score
    : todaysGame.value.homeTeam?.score;

  // Check for recent goal against champion
  if (
    (isChampionHome && recentGoalAgainst.value.home) ||
    (!isChampionHome && recentGoalAgainst.value.away)
  ) {
    return 'Anguish';
  }

  // Champion winning = Happy, losing = Angry
  return championScore > challengerScore ? 'Happy' : 'Angry';
});

const challengerAvatarType = computed(() => {
  if (!isGameLive.value) {
    return 'Happy';
  }

  const isChampionHome =
    currentChampion.value === todaysGame.value.homeTeam?.abbrev;
  const championScore = isChampionHome
    ? todaysGame.value.homeTeam?.score
    : todaysGame.value.awayTeam?.score;
  const challengerScore = isChampionHome
    ? todaysGame.value.awayTeam?.score
    : todaysGame.value.homeTeam?.score;

  // Check for recent goal against challenger
  if (
    (isChampionHome && recentGoalAgainst.value.away) ||
    (!isChampionHome && recentGoalAgainst.value.home)
  ) {
    return 'Anguish';
  }

  // Challenger winning = Happy, losing = Angry
  return challengerScore > championScore ? 'Happy' : 'Angry';
});

const gameOverWinnerAvatarType = computed(() => {
  return 'Happy';
});

const gameOverLoserAvatarType = computed(() => {
  return 'Sad';
});

const conditionalMatchupsHeading = computed(() => {
  if (selectedWinnerRole.value === 'champion') {
    return `Possible Upcoming Match-ups If ${playerChampion.value?.name || 'Champion'} Wins Tonight`;
  }
  if (selectedWinnerRole.value === 'challenger') {
    return `Possible Upcoming Match-ups If ${playerChallenger.value?.name || 'Challenger'} Wins Tonight`;
  }
  return 'Possible Upcoming Match-ups';
});

// const showMatchupSelector = computed(() => matchupOptions.value.length > 0);

watch(
  () => todaysGame.value.clock?.secondsRemaining,
  (newVal) => {
    if (newVal !== undefined) {
      secondsRemaining.value = newVal;
    }
  }
);

// Watch for WebSocket game updates
watch(lastMessage, (data) => {
  const incomingGameId = data?.payload?.id;
  if (
    data?.type === 'liveGameUpdate' &&
    (!incomingGameId ||
      String(incomingGameId) ===
        String(selectedGameId.value || cupGameId.value))
  ) {
    applyGameUpdate(data.payload);
  }
});

// Watch for score changes to detect goals
watch(
  () => todaysGame.value.homeTeam?.score,
  (newScore, oldScore) => {
    if (oldScore !== undefined && newScore > oldScore) {
      // Goal scored by home team, away team gets anguish
      triggerAnguishAvatar('away');
    }
    previousHomeScore.value = newScore;
  }
);

watch(
  () => todaysGame.value.awayTeam?.score,
  (newScore, oldScore) => {
    if (oldScore !== undefined && newScore > oldScore) {
      // Goal scored by away team, home team gets anguish
      triggerAnguishAvatar('home');
    }
    previousAwayScore.value = newScore;
  }
);

onMounted(async () => {
  // If season is over, skip all game and team data fetching
  if (isSeasonOver.value) {
    loading.value = false;
    return;
  }

  try {
    await refreshChampionAndGameState();
    // Players data is now handled by useCurrentSeasonData composable (always current season)
  } catch (error) {
    console.error('Error fetching getCurrentChampion or getGameId:', error);
  }
  startChampionRefresh();
  visibilityHandlerBound = () => {
    if (document.visibilityState === 'visible') {
      refreshChampionAndGameState({ bustCache: true });
    }
  };
  document.addEventListener('visibilitychange', visibilityHandlerBound);

  isGameToday.value = gameID.value !== null;
  if (isGameToday.value) {
    await getGameInfo(cupGameId.value);
    await loadMatchupOptions();
    initSocket();
    startPolling();
  } else {
    matchupOptions.value = [];
    playerChampion.value = allPlayersData.value.find((player) =>
      player.teams.includes(currentChampion.value)
    );
    getPossibleMatchUps(currentChampion.value);
    loading.value = false;
  }
});

async function refreshChampionAndGameState(options = {}) {
  try {
    const [champion, activeGameId] = await Promise.all([
      getCurrentChampion(options),
      getGameId(options),
    ]);
    currentChampion.value = champion;
    gameID.value = activeGameId;
    cupGameId.value = activeGameId;
    if (!selectedGameId.value || options?.forceGameSelectionReset) {
      selectedGameId.value = activeGameId;
    }
  } catch (error) {
    console.error('Error refreshing champion/game state:', error);
  }
}

async function getGameInfo(
  targetGameId = selectedGameId.value || cupGameId.value
) {
  if (!targetGameId) return;

  try {
    const result = await nhlApi.getGameInfo(targetGameId);
    applyGameUpdate(result.data);
  } catch (error) {
    console.error('Error fetching game result:', error);
  } finally {
    loading.value = false;
  }
}

function buildMatchupLabel(game, defaultGameId) {
  const awayTeam = game?.awayTeam?.abbrev || 'AWAY';
  const homeTeam = game?.homeTeam?.abbrev || 'HOME';
  const isCupMatchup = String(game?.id) === String(defaultGameId);
  return `${awayTeam} @ ${homeTeam}${isCupMatchup ? ' (Cup Defense)' : ''}`;
}

async function loadMatchupOptions() {
  if (!cupGameId.value) {
    matchupOptions.value = [];
    return;
  }

  matchupOptionsLoading.value = true;
  const scheduleDate = todaysGame.value.startTimeUTC
    ? DateTime.fromISO(todaysGame.value.startTimeUTC).toFormat('yyyy-MM-dd')
    : DateTime.now().toFormat('yyyy-MM-dd');

  try {
    const scheduleData = await nhlApi.getSchedule(scheduleDate);
    const gameWeek = scheduleData?.data?.gameWeek || [];
    const datedGames = gameWeek
      .filter((entry) => entry?.date === scheduleDate)
      .flatMap((entry) => entry?.games || []);
    const currentDayGames = datedGames.length
      ? datedGames
      : gameWeek.flatMap((entry) => entry?.games || []);
    const cupGame = currentDayGames.find(
      (game) => String(game.id) === String(cupGameId.value)
    );
    matchupOptions.value = cupGame
      ? [
          {
            id: String(cupGame.id),
            label: buildMatchupLabel(cupGame, cupGameId.value),
          },
        ]
      : [];

    if (!matchupOptions.value.length) {
      matchupOptions.value = [
        {
          id: String(cupGameId.value),
          label: `Cup Matchup (${cupGameId.value})`,
        },
      ];
    }
  } catch (err) {
    console.error('Failed to load game-day matchups', err);
    matchupOptions.value = [
      {
        id: String(cupGameId.value),
        label: `Cup Matchup (${cupGameId.value})`,
      },
    ];
  } finally {
    selectedGameId.value = String(
      selectedGameId.value ||
        matchupOptions.value.find(
          (option) => String(option.id) === String(cupGameId.value)
        )?.id ||
        matchupOptions.value[0]?.id ||
        cupGameId.value
    );
    matchupOptionsLoading.value = false;
  }
}

// async function handleMatchupSelection() {
//   if (!cupGameId.value) return;
//   selectedGameId.value = String(cupGameId.value);
//   loading.value = true;
//   await getGameInfo(cupGameId.value);
// }

function getTeamsInfo(gameData = todaysGame.value) {
  const homeTeam = gameData.homeTeam;
  const awayTeam = gameData.awayTeam;
  const championIsHome = currentChampion.value === homeTeam?.abbrev;
  const championIsAway = currentChampion.value === awayTeam?.abbrev;

  if (!championIsHome && !championIsAway) {
    return false;
  }

  const championTeam = championIsHome ? homeTeam : awayTeam;
  const challengerTeam = championIsHome ? awayTeam : homeTeam;

  const championPlayer =
    allPlayersData.value.find((player) =>
      player.teams.includes(championTeam?.abbrev)
    ) ||
    playerChampion.value ||
    {};

  const challengerPlayer =
    allPlayersData.value.find((player) =>
      player.teams.includes(challengerTeam?.abbrev)
    ) ||
    playerChallenger.value ||
    {};

  playerChampion.value = { ...championPlayer, championTeam };
  playerChallenger.value = { ...challengerPlayer, challengerTeam };

  isMirrorMatch.value =
    playerChampion.value?.name === playerChallenger.value?.name;

  return true;
}

function getQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const selectedQuote = quotes[randomIndex];

  // Replace {name} placeholder with the losing player's name
  const playerName = todaysLoser.value.player?.name || 'opponent';
  return selectedQuote.replace(/{name}/g, playerName);
}

function resetConditionalMatchups() {
  conditionalMatchupsRequestId += 1;
  selectedWinnerRole.value = '';
  conditionalMatchups.value = [];
  conditionalMatchupsLoading.value = false;
}

async function handleWinnerSelection(role) {
  selectedWinnerRole.value = role;
  const winnerTeamAbbrev =
    role === 'champion'
      ? playerChampion.value?.championTeam?.abbrev
      : playerChallenger.value?.challengerTeam?.abbrev;

  if (!winnerTeamAbbrev) {
    conditionalMatchups.value = [];
    return;
  }

  await getConditionalMatchUps(winnerTeamAbbrev);
}

async function getConditionalMatchUps(winnerTeamAbbrev) {
  const requestId = ++conditionalMatchupsRequestId;
  conditionalMatchupsLoading.value = true;
  const gameDate = todaysGame.value?.startTimeUTC
    ? DateTime.fromISO(todaysGame.value.startTimeUTC)
    : DateTime.now();
  const targetDate = gameDate.plus({ days: 1 }).toFormat('yyyy-MM-dd');
  try {
    const scheduleData = await nhlApi.getSchedule(targetDate);
    const gameWeek = Array.isArray(scheduleData?.data?.gameWeek)
      ? scheduleData.data.gameWeek
      : [];
    const remainingWeekGames = gameWeek
      .filter((entry) => entry?.date && entry.date >= targetDate)
      .flatMap((entry) => entry?.games || []);

    const resolvedMatchups = remainingWeekGames
      .filter(
        (game) =>
          game?.homeTeam?.abbrev === winnerTeamAbbrev ||
          game?.awayTeam?.abbrev === winnerTeamAbbrev
      )
      .map((game) => {
        const opponentTeam =
          game.homeTeam.abbrev === winnerTeamAbbrev
            ? game.awayTeam
            : game.homeTeam;

        return {
          ...game,
          dateTime: DateTime.fromISO(game.startTimeUTC).toFormat(
            'MM/dd h:mm a ZZZZ'
          ),
          opponentTeam,
        };
      })
      .sort(
        (a, b) =>
          DateTime.fromISO(a.startTimeUTC).toMillis() -
          DateTime.fromISO(b.startTimeUTC).toMillis()
      );
    if (requestId === conditionalMatchupsRequestId) {
      conditionalMatchups.value = resolvedMatchups;
    }
  } catch (err) {
    console.error('Failed to load conditional matchups', err);
    if (requestId === conditionalMatchupsRequestId) {
      conditionalMatchups.value = [];
    }
  } finally {
    if (requestId === conditionalMatchupsRequestId) {
      conditionalMatchupsLoading.value = false;
    }
  }
}

async function getPossibleMatchUps(championTeam) {
  const upcomingGames = [];
  const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');

  try {
    const scheduleData = await nhlApi.getSchedule(tomorrow);
    const gameWeek = scheduleData?.data?.gameWeek;
    if (!Array.isArray(gameWeek)) {
      possibleMatchUps.value = [];
      potentialLoading.value = false;
      return;
    }

    gameWeek.forEach((date) => {
      (date?.games || []).forEach((game) => {
        const { id, homeTeam, awayTeam, startTimeUTC } = game;
        if (
          homeTeam?.abbrev === championTeam ||
          awayTeam?.abbrev === championTeam
        ) {
          upcomingGames.push({
            id,
            homeTeam,
            awayTeam,
            dateTime:
              DateTime.fromISO(startTimeUTC).toFormat('MM/dd h:mm a ZZZZ'),
          });
        }
      });
    });
    possibleMatchUps.value = upcomingGames;
  } catch (err) {
    console.error('Failed to load possible matchups', err);
    possibleMatchUps.value = [];
  } finally {
    potentialLoading.value = false;
  }
}

function getTeamOwner(teamAbbrev) {
  const teamOwner = allPlayersData.value.find((player) =>
    player.teams.includes(teamAbbrev)
  );
  return teamOwner;
}

function getTeamOwnerName(teamAbbrev) {
  return getTeamOwner(teamAbbrev)?.name || 'Unknown';
}

function triggerAnguishAvatar(team) {
  // Clear existing timer if any
  if (goalTimers.value[team]) {
    clearTimeout(goalTimers.value[team]);
  }

  // Set anguish state
  recentGoalAgainst.value[team] = true;

  // Clear anguish after 1 minute
  goalTimers.value[team] = setTimeout(() => {
    recentGoalAgainst.value[team] = false;
    goalTimers.value[team] = null;
  }, 60000);
}

function applyGameUpdate(gameData) {
  if (!gameData) return;

  const wasGameOver = isGameOver.value;
  todaysGame.value = gameData;
  secondsRemaining.value = gameData.clock?.secondsRemaining ?? 0;
  isGameOver.value = ['FINAL', 'OFF'].includes(gameData.gameState);
  isGameLive.value = ['LIVE', 'CRIT'].includes(gameData.gameState);
  lastLiveUpdateAt.value = Date.now();

  if (gameData.startTimeUTC) {
    localStartTime.value = DateTime.fromISO(
      gameData.startTimeUTC
    ).toLocaleString(DateTime.DATETIME_FULL);
  }

  const championPlaying = getTeamsInfo(gameData);

  if (!championPlaying) {
    // Champion is not playing today, treat as no game
    resetConditionalMatchups();
    isGameToday.value = false;
    playerChampion.value = allPlayersData.value.find((player) =>
      player.teams.includes(currentChampion.value)
    );
    potentialLoading.value = true;
    getPossibleMatchUps(currentChampion.value);
    stopPolling();
    return;
  }

  isGameToday.value = true;

  if (isGameOver.value) {
    resetConditionalMatchups();
    setGameOutcome(gameData);
    if (!wasGameOver) {
      refreshChampionAndGameState({ bustCache: true });
    }
    potentialLoading.value = true;
    getPossibleMatchUps(todaysWinner.value.abbrev);
    stopPolling();
  } else {
    startPolling();
  }
}

function setGameOutcome(gameData) {
  const homeTeam = gameData.homeTeam;
  const awayTeam = gameData.awayTeam;
  if (!homeTeam || !awayTeam) return;

  const winnerTeam = homeTeam.score > awayTeam.score ? homeTeam : awayTeam;
  const loserTeam = winnerTeam === homeTeam ? awayTeam : homeTeam;

  todaysWinner.value = {
    ...winnerTeam,
    player: allPlayersData.value.find((player) =>
      player.teams.includes(winnerTeam.abbrev)
    ),
  };
  todaysLoser.value = {
    ...loserTeam,
    player: allPlayersData.value.find((player) =>
      player.teams.includes(loserTeam.abbrev)
    ),
  };
}

function shouldPollGame() {
  return (
    Boolean(selectedGameId.value) && isGameToday.value && !isGameOver.value
  );
}

function startPolling() {
  if (pollIntervalId || !shouldPollGame()) return;

  pollIntervalId = setInterval(() => {
    if (!shouldPollGame()) {
      stopPolling();
      return;
    }

    const now = Date.now();
    const isStale = now - lastLiveUpdateAt.value > POLL_INTERVAL_MS;

    if (isDisconnected.value || isStale) {
      getGameInfo();
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

function startChampionRefresh() {
  if (championRefreshIntervalId) return;
  championRefreshIntervalId = setInterval(() => {
    refreshChampionAndGameState({ bustCache: true });
  }, CHAMPION_REFRESH_MS);
}

function stopChampionRefresh() {
  if (championRefreshIntervalId) {
    clearInterval(championRefreshIntervalId);
    championRefreshIntervalId = null;
  }
}

onBeforeUnmount(() => {
  stopPolling();
  stopChampionRefresh();
  if (visibilityHandlerBound) {
    document.removeEventListener('visibilitychange', visibilityHandlerBound);
    visibilityHandlerBound = null;
  }
  Object.values(goalTimers.value).forEach((timer) => {
    if (timer) {
      clearTimeout(timer);
    }
  });
});
</script>

<style></style>
