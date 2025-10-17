<template>
  <v-container class="max-w-[570px] min-h-32">
    <h1
      class="text-4xl font-bold mb-4"
      :class="{ 'text-center': isSeasonOver }"
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
          <div>
            <div class="text-center font-bold text-xl mb-2">Champion</div>
            <PlayerCard
              :player="playerChampion"
              :team="playerChampion.championTeam"
              :image-type="championAvatarType"
              :is-game-live="isGameLive"
              :is-champion="true"
            />
          </div>
          <div class="flex justify-center items-center">
            <strong>VS</strong>
          </div>
          <div>
            <div class="text-center font-bold text-xl mb-2">Challenger</div>
            <PlayerCard
              :player="playerChallenger"
              :team="playerChallenger.challengerTeam"
              :image-type="challengerAvatarType"
              :is-game-live="isGameLive"
              :is-mirror-match="isMirrorMatch"
            />
          </div>
        </div>
        <div class="text-center mb-4">
          <router-link
            :to="`/game/${todaysGame.id}`"
            class="text-blue-500 underline"
            >View Game Details</router-link
          >
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
                      :to="`/player/${getTeamOwner(game.homeTeam.abbrev).name}`"
                      >{{ getTeamOwner(game.homeTeam.abbrev).name }}
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
                      :to="`/player/${getTeamOwner(game.awayTeam.abbrev).name}`"
                      >{{ getTeamOwner(game.awayTeam.abbrev).name }}
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
import { ref, computed, watch, onMounted } from 'vue';
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
// Add new reactive state for avatar management
const previousHomeScore = ref(0);
const previousAwayScore = ref(0);
const recentGoalAgainst = ref({ home: false, away: false });
const goalTimers = ref({ home: null, away: null });

// WebSocket
const { lastMessage, isConnected } = useSocket();
const isDisconnected = ref(false);
watch(isConnected, (newVal) => {
  isDisconnected.value = !newVal;
});

const clockTime = computed(() => {
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
  console.log('🚀 ~ watch ~ data:', data);
  if (data?.type === 'liveGameUpdate') {
    // Update whatever fields are affected by the change
    const updatedGame = data.payload;

    todaysGame.value = updatedGame;
    secondsRemaining.value = updatedGame.clock?.secondsRemaining || 0;
    isGameOver.value = ['FINAL', 'OFF'].includes(updatedGame.gameState);
    isGameLive.value = ['LIVE', 'CRIT'].includes(updatedGame.gameState);
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
    currentChampion.value = await getCurrentChampion();
    gameID.value = await getGameId();
    // Players data is now handled by useCurrentSeasonData composable (always current season)
  } catch (error) {
    console.error('Error fetching getCurrentChampion or getGameId:', error);
  }
  isGameToday.value = gameID.value !== null;
  if (isGameToday.value) {
    getGameInfo();
    initSocket();
  } else {
    playerChampion.value = allPlayersData.value.find((player) =>
      player.teams.includes(currentChampion.value)
    );
    getPossibleMatchUps(currentChampion.value);
    loading.value = false;
  }

  setInterval(() => {
    if (!isGameOver.value && !isDisconnected.value) {
      getGameInfo();
    }
  }, 60000);
});

function getGameInfo() {
  nhlApi
    .getGameInfo(gameID.value)
    .then((result) => {
      todaysGame.value = result.data;
      isGameOver.value = ['FINAL', 'OFF'].includes(result.data.gameState);
      isGameLive.value = ['LIVE', 'CRIT'].includes(result.data.gameState);
      localStartTime.value = DateTime.fromISO(
        result.data.startTimeUTC
      ).toLocaleString(DateTime.DATETIME_FULL);

      // Check if current champion is actually playing in this game
      const homeTeam = todaysGame.value.homeTeam;
      const awayTeam = todaysGame.value.awayTeam;
      const championIsPlaying =
        currentChampion.value === homeTeam?.abbrev ||
        currentChampion.value === awayTeam?.abbrev;

      if (championIsPlaying) {
        getTeamsInfo();

        if (isGameOver.value) {
          if (homeTeam.score > awayTeam.score) {
            todaysWinner.value = homeTeam;
            todaysLoser.value = awayTeam;
          } else {
            todaysWinner.value = awayTeam;
            todaysLoser.value = homeTeam;
          }

          const getWinningPlayer = allPlayersData.value.find((player) =>
            player.teams.includes(todaysWinner.value.abbrev)
          );
          const getLosingPlayer = allPlayersData.value.find((player) =>
            player.teams.includes(todaysLoser.value.abbrev)
          );
          todaysWinner.value.player = getWinningPlayer;
          todaysLoser.value.player = getLosingPlayer;
          getPossibleMatchUps(todaysWinner.value.abbrev);
        }
      } else {
        // Champion is not playing today, treat as no game
        isGameToday.value = false;
        playerChampion.value = allPlayersData.value.find((player) =>
          player.teams.includes(currentChampion.value)
        );
        getPossibleMatchUps(currentChampion.value);
      }
    })
    .catch((error) => {
      console.error('Error fetching game result:', error);
    })
    .finally(() => {
      loading.value = false;
    });
}

function getTeamsInfo() {
  const homeTeam = todaysGame.value.homeTeam;
  const awayTeam = todaysGame.value.awayTeam;
  const getChampionTeam =
    currentChampion.value === homeTeam?.abbrev ? homeTeam : awayTeam;
  const getChallengerTeam =
    currentChampion.value === homeTeam?.abbrev ? awayTeam : homeTeam;

  playerChampion.value = allPlayersData.value.find((player) =>
    player.teams.includes(getChampionTeam?.abbrev)
  );
  playerChampion.value.championTeam = getChampionTeam;
  playerChallenger.value = allPlayersData.value.find((player) =>
    player.teams.includes(getChallengerTeam?.abbrev)
  );
  playerChallenger.value.challengerTeam = getChallengerTeam;

  isMirrorMatch.value =
    playerChampion.value.name === playerChallenger.value.name;
}

function getQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const selectedQuote = quotes[randomIndex];

  // Replace {name} placeholder with the losing player's name
  const playerName = todaysLoser.value.player?.name || 'opponent';
  return selectedQuote.replace(/{name}/g, playerName);
}

async function getPossibleMatchUps(championTeam) {
  const upcomingGames = [];
  const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');
  const scheduleData = await nhlApi.getSchedule(tomorrow);

  scheduleData.data.gameWeek.forEach((date) => {
    date.games.forEach((game) => {
      const { id, homeTeam, awayTeam, startTimeUTC } = game;
      if (
        homeTeam.abbrev === championTeam ||
        awayTeam.abbrev === championTeam
      ) {
        upcomingGames.push({
          id: id,
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          dateTime:
            DateTime.fromISO(startTimeUTC).toFormat('MM/dd h:mm a ZZZZ'),
        });
      }
    });
  });
  possibleMatchUps.value = upcomingGames;
  potentialLoading.value = false;
}

function getTeamOwner(teamAbbrev) {
  const teamOwner = allPlayersData.value.find((player) =>
    player.teams.includes(teamAbbrev)
  );
  return teamOwner;
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
</script>

<style></style>
