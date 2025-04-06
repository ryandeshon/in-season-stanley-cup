<template>
  <v-container class="py-10">
    <v-row class="mb-8" dense>
      <v-col
        v-for="player in allPlayersData"
        :key="player.playerId"
        cols="12"
        sm="3"
        class="text-center"
      >
        <PlayerCard
          :player="player"
          image-type="Winner"
          :show-team-logo="false"
        />
      </v-col>
    </v-row>

    <div class="text-center text-h5 font-weight-semibold mb-4">
      <span v-if="currentPickerName === currentPlayerName" class="text-success">
        It's your turn!
      </span>
      <span v-else class="text-secondary">
        Waiting for {{ currentPickerName }}...
      </span>
      <div class="mt-2 text-body-2 text-secondary">
        Time Remaining: {{ countdown }} seconds
      </div>
    </div>

    <v-row dense>
      <v-col v-for="team in nhlTeams" :key="team" cols="2">
        <v-card
          class="cursor-pointer"
          :class="{ picked: pickedTeams.includes(team) }"
          outlined
          @click="selectTeam(team)"
        >
          <v-img
            :src="`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`"
            height="100px"
          ></v-img>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  getAllPlayers,
  getDraftState,
  selectTeamForPlayer,
} from '../services/dynamodbService';
import PlayerCard from '@/components/PlayerCard.vue';

const route = useRoute();
const currentPlayerName = route.params.name;

const allPlayersData = ref([]);
const currentPickerName = ref('');
const countdown = ref(60);
const draftState = ref(null);

const nhlTeams = ref([
  'ANA',
  'ARI',
  'BOS',
  'BUF',
  'CGY',
  'CAR',
  'CHI',
  'COL',
  'CBJ',
  'DAL',
  'DET',
  'EDM',
  'FLA',
  'LAK',
  'MIN',
  'MTL',
  'NSH',
  'NJD',
  'NYI',
  'NYR',
  'OTT',
  'PHI',
  'PIT',
  'SJS',
  'SEA',
  'STL',
  'TBL',
  'TOR',
  'VAN',
  'VGK',
  'WSH',
  'WPG',
]);

// Fetch initial data from backend
async function loadInitialData() {
  try {
    allPlayersData.value = await getAllPlayers();
    draftState.value = await getDraftState();

    currentPickerName.value = draftState.value.currentPicker;
    countdown.value = calculateRemainingTime(draftState.value.pickDeadline);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Countdown timer synced with backend
function calculateRemainingTime(deadline) {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(deadline - now, 0);
}

onMounted(() => {
  loadInitialData();

  setInterval(async () => {
    countdown.value--;
    if (countdown.value <= 0) {
      await loadInitialData(); // reload draft state when timer ends
    }
  }, 1000);
});

// Team selection logic (only when it's player's turn)
async function selectTeam(team) {
  if (currentPickerName.value !== currentPlayerName) {
    alert("It's not your turn!");
    return;
  }

  try {
    await selectTeamForPlayer(currentPlayerName, team);
    alert('Team successfully selected!');
    await loadInitialData(); // refresh state
  } catch (error) {
    alert(error.message);
  }
}

// Computed property to grayscale picked teams
const pickedTeams = computed(() => {
  return allPlayersData.value.flatMap((player) => player.teams);
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.picked {
  filter: grayscale(100%);
  opacity: 0.6;
}
</style>
