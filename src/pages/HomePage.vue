<template>
  <v-container class="max-w-[570px] min-h-32">
    <h1 class="text-4xl font-bold mb-4">In Season Cup</h1>
    <template v-if="loading">
      <div class="flex justify-center items-center mt-4 h-40">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>
    </template>

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
            image-type="Winner"
            :is-game-live="isGameLive"
          />
          <div>
            <PlayerCard
              :player="todaysLoser.player"
              :team="todaysLoser"
              image-type="Sad"
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
                image-type="Challenger"
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
              image-type="Challenger"
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
              image-type="Challenger"
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
            image-type="Winner"
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
                    <img
                      :src="`https://assets.nhle.com/logos/nhl/svg/${game.homeTeam.abbrev}_${isDarkOrLight}.svg`"
                      :alt="game.homeTeam.abbrev"
                      class="w-10 h-10"
                    />
                  </div>
                </td>
                <td class="">vs</td>
                <td>
                  <div
                    class="flex flex-col sm:flex-row sm:gap-2 justify-center items-center"
                  >
                    <img
                      :src="`https://assets.nhle.com/logos/nhl/svg/${game.awayTeam.abbrev}_${isDarkOrLight}.svg`"
                      :alt="game.awayTeam.abbrev"
                      class="w-10 h-10"
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
import { getAllPlayers } from '../services/dynamodbService';
import { getCurrentChampion, getGameId } from '../services/championServices';
import PlayerCard from '@/components/PlayerCard.vue';
import { useThemeStore } from '@/store/themeStore';

import quotes from '@/utilities/quotes.json';

const loading = ref(true);
const potentialLoading = ref(true);
const currentChampion = ref(null);
const localStartTime = ref(null);
const todaysGame = ref({});
const todaysWinner = ref({});
const todaysLoser = ref({});
const allPlayersData = ref({});
const playerChampion = ref({});
const playerChallenger = ref({});
const possibleMatchUps = ref([]);
const secondsRemaining = ref(null);
const isGameToday = ref(false);
const isGameOver = ref(false);
const isGameLive = ref(false);
const isMirrorMatch = ref(false);
const gameID = ref(null);

const themeStore = useThemeStore();
const isDarkOrLight = ref(themeStore.isDarkTheme ? 'dark' : 'light');
watch(
  () => themeStore.isDarkTheme,
  (newVal) => {
    isDarkOrLight.value = newVal ? 'dark' : 'light';
  },
  { immediate: true }
);

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

watch(
  () => todaysGame.value.clock?.secondsRemaining,
  (newVal) => {
    if (newVal !== undefined) {
      secondsRemaining.value = newVal;
    }
  }
);

onMounted(async () => {
  try {
    currentChampion.value = await getCurrentChampion();
    gameID.value = await getGameId();
    allPlayersData.value = await getAllPlayers();
  } catch (error) {
    console.error('Error fetching getCurrentChampion or getGameId:', error);
  }
  isGameToday.value = gameID.value !== null;
  if (isGameToday.value) {
    getGameInfo();
  } else {
    playerChampion.value = allPlayersData.value.find((player) =>
      player.teams.includes(currentChampion.value)
    );
    getPossibleMatchUps(currentChampion.value);
    loading.value = false;
  }
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
    })
    .catch((error) => {
      console.error('Error fetching game result:', error);
    })
    .finally(() => {
      getTeamsInfo();

      if (isGameOver.value) {
        const homeTeam = todaysGame.value.homeTeam;
        const awayTeam = todaysGame.value.awayTeam;

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
      loading.value = false;
    });
}

function getTeamsInfo() {
  const homeTeam = todaysGame.value.homeTeam;
  const awayTeam = todaysGame.value.awayTeam;
  const getChampionTeam =
    currentChampion.value === homeTeam.abbrev ? homeTeam : awayTeam;
  const getChallengerTeam =
    currentChampion.value === homeTeam.abbrev ? awayTeam : homeTeam;

  playerChampion.value = allPlayersData.value.find((player) =>
    player.teams.includes(getChampionTeam.abbrev)
  );
  playerChampion.value.championTeam = getChampionTeam;
  playerChallenger.value = allPlayersData.value.find((player) =>
    player.teams.includes(getChallengerTeam.abbrev)
  );
  playerChallenger.value.challengerTeam = getChallengerTeam;

  isMirrorMatch.value =
    playerChampion.value.name === playerChallenger.value.name;
}

function getQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
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
</script>

<style></style>
