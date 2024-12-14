<template>
  <v-container class="max-w-[570px] min-h-32">
    <h1 class="text-4xl font-bold mb-4">In Season Cup</h1>
    <template v-if="loading">
      <div class="flex justify-center items-center mt-10 h-40">
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
          <div class="flex justify-center items-center mt-10 h-40">
            <v-progress-circular
              indeterminate
              color="primary"
            ></v-progress-circular>
          </div>
        </template>
        <div v-else class="text-center mb-4">
          <h2 class="text-xl font-bold">Possible Upcoming Match-ups</h2>
          <v-table class="mt-10">
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
                    {{ getTeamOwner(game.homeTeam.abbrev).name }}
                    <img
                      :src="`https://assets.nhle.com/logos/nhl/svg/${game.homeTeam.abbrev}_light.svg`"
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
                      :src="`https://assets.nhle.com/logos/nhl/svg/${game.awayTeam.abbrev}_light.svg`"
                      :alt="game.awayTeam.abbrev"
                      class="w-10 h-10"
                    />
                    {{ getTeamOwner(game.awayTeam.abbrev).name }}
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

<script>
import { DateTime } from 'luxon';
import nhlApi from '../services/nhlApi';
import { getAllPlayers } from '../services/dynamodbService';
import { getCurrentChampion, getGameId } from '../services/championServices';
import PlayerCard from '@/components/PlayerCard.vue';

import quotes from '@/utilities/quotes.json';

export default {
  name: 'HomePage',
  components: {
    PlayerCard,
  },
  data() {
    return {
      loading: true,
      potentialLoading: true,
      currentChampion: null,
      localStartTime: null,
      todaysGame: {},
      todaysWinner: {},
      todaysLoser: {},
      allPlayersData: {},
      playerChampion: {},
      playerChallenger: {},
      boxScore: {},
      possibleMatchUps: [],
      secondsRemaining: null,
      isGameToday: false,
      isGameOver: false,
      isGameLive: false,
      isMirrorMatch: false,
      gameID: null,
    };
  },
  computed: {
    clockTime() {
      return DateTime.fromSeconds(this.secondsRemaining).toFormat('mm:ss');
    },
    period() {
      if (this.todaysGame.periodDescriptor.periodType === 'OT') {
        return 'OT';
      }
      return this.todaysGame.periodDescriptor.number;
    },
    firstGameNonChampionTeam() {
      if (this.possibleMatchUps.length === 0) {
        return null;
      }
      const firstGame = this.possibleMatchUps[0];
      const nonChampionTeam =
        firstGame.homeTeam.abbrev === this.currentChampion
          ? firstGame.awayTeam
          : firstGame.homeTeam;
      const player = this.allPlayersData.find((player) =>
        player.teams.includes(nonChampionTeam.abbrev)
      );
      return {
        date: firstGame.dateTime,
        team: nonChampionTeam,
        player: player,
      };
    },
  },
  watch: {
    'todaysGame.clock.secondsRemaining': function (newVal) {
      if (newVal !== undefined) {
        this.secondsRemaining = newVal;
      }
    },
  },
  async created() {
    try {
      this.currentChampion = await getCurrentChampion();
      this.gameID = await getGameId();
      // this.currentChampion = 'NYR';
      // this.gameID = '2024020247';
      this.allPlayersData = await getAllPlayers();
      // console.log("🚀 ~ created ~ this.allPlayersData:", this.allPlayersData)
    } catch (error) {
      console.error('Error fetching getCurrentChampion or getGameId:', error);
    }
    this.isGameToday = this.gameID !== null;
    this.getPossibleMatchUps();
    if (this.isGameToday) {
      this.getGameInfo();
    } else {
      // If there is no game today, fetch the current champion info
      this.playerChampion = this.allPlayersData.find((player) =>
        player.teams.includes(this.currentChampion)
      );
      this.loading = false;
    }
  },
  methods: {
    getGameInfo() {
      // If there is a game today, fetch the game result
      nhlApi
        .getGameInfo(this.gameID)
        .then((result) => {
          this.todaysGame = result.data;
          this.isGameOver = ['FINAL', 'OFF'].includes(result.data.gameState);
          this.isGameLive = ['LIVE', 'CRIT'].includes(result.data.gameState);
          this.localStartTime = DateTime.fromISO(
            result.data.startTimeUTC
          ).toLocaleString(DateTime.DATETIME_FULL);
        })
        .catch((error) => {
          console.error('Error fetching game result:', error);
        })
        .finally(() => {
          this.getTeamsInfo();

          // find score and winner
          if (this.isGameOver) {
            const homeTeam = this.todaysGame.homeTeam;
            const awayTeam = this.todaysGame.awayTeam;

            if (homeTeam.score > awayTeam.score) {
              this.todaysWinner = homeTeam;
              this.todaysLoser = awayTeam;
            } else {
              this.todaysWinner = awayTeam;
              this.todaysLoser = homeTeam;
            }

            const getWinningPlayer = this.allPlayersData.find((player) =>
              player.teams.includes(this.todaysWinner.abbrev)
            );
            const getLosingPlayer = this.allPlayersData.find((player) =>
              player.teams.includes(this.todaysLoser.abbrev)
            );
            this.todaysWinner.player = getWinningPlayer;
            this.todaysLoser.player = getLosingPlayer;
          }
          this.loading = false;
        });
    },
    getTeamsInfo() {
      const homeTeam = this.todaysGame.homeTeam;
      const awayTeam = this.todaysGame.awayTeam;
      const getChampionTeam =
        this.currentChampion === homeTeam.abbrev ? homeTeam : awayTeam;
      const getChallengerTeam =
        this.currentChampion === homeTeam.abbrev ? awayTeam : homeTeam;

      this.playerChampion = this.allPlayersData.find((player) =>
        player.teams.includes(getChampionTeam.abbrev)
      );
      this.playerChampion.championTeam = getChampionTeam;
      this.playerChallenger = this.allPlayersData.find((player) =>
        player.teams.includes(getChallengerTeam.abbrev)
      );
      this.playerChallenger.challengerTeam = getChallengerTeam;

      this.isMirrorMatch =
        this.playerChampion.name === this.playerChallenger.name;
    },
    getQuote() {
      const randomIndex = Math.floor(Math.random() * quotes.length);
      return quotes[randomIndex];
    },
    async getPossibleMatchUps() {
      const upcomingGames = [];
      const tomorrow = DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd');
      const scheduleData = await nhlApi.getSchedule(tomorrow);

      scheduleData.data.gameWeek.forEach((date) => {
        date.games.forEach((game) => {
          const { id, homeTeam, awayTeam, startTimeUTC } = game;
          if (
            homeTeam.abbrev === this.currentChampion ||
            awayTeam.abbrev === this.currentChampion
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
      this.possibleMatchUps = upcomingGames;
      this.potentialLoading = false;
    },
    getTeamOwner(teamAbbrev) {
      const teamOwner = this.allPlayersData.find((player) =>
        player.teams.includes(teamAbbrev)
      );
      return teamOwner;
    },
  },
};
</script>

<style></style>
