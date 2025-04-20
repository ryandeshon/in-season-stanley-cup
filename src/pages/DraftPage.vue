<template>
  <v-alert
    v-if="isDisconnected"
    type="warning"
    class="fixed m-auto w-full text-center mb-4 z-50"
  >
    WebSocket disconnected. Trying to reconnect...
  </v-alert>
  <v-container class="py-10">
    <v-row
      class="text-center mb-8"
      justify="center"
      v-if="!draftState?.draftStarted"
    >
      <v-btn @click="startDraft" color="primary"> Start Draft </v-btn>
    </v-row>

    <v-col class="text-center mb-8" justify="center" v-else>
      <h1 class="text-4xl font-bold mb-4">Draft in Progress</h1>
      <div class="text-subtitle-1">
        <span v-if="currentPicker">
          Current Pick:
          <strong>{{ currentPicker.name }}</strong>
        </span>
      </div>
    </v-col>

    <v-row class="mb-10" dense>
      <v-col
        v-for="player in orderedPlayers"
        :key="player.playerId"
        cols="6"
        sm="3"
        class="text-center"
      >
        <PlayerCard
          :player="player"
          image-type="Winner"
          :show-team-logo="false"
          class="border-4"
          :class="{
            'border-success': player.id === currentPickerId,
            'border-primary':
              player.id !== currentPickerId && player.name == playerName,
          }"
        />
        <div class="text-caption my-2 font-italic">Selected Teams:</div>
        <v-row justify="center" dense>
          <v-col
            v-for="team in player.teams"
            :key="team"
            cols="3"
            class="d-flex justify-center"
          >
            <v-img
              :src="`https://assets.nhle.com/logos/nhl/svg/${team}_${isDarkOrLight}.svg`"
              width="40"
              height="40"
              :alt="team"
            />
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <h2 class="text-center text-xl font-bold">Available Teams</h2>
    <v-row dense>
      <v-col
        v-for="team in nhlTeams"
        :key="team"
        cols="12"
        sm="6"
        md="3"
        class="flex justify-center"
      >
        <v-card
          outlined
          :elevation="pickedTeams.includes(team) ? 0 : 2"
          class="w-full p-2"
          :class="{
            picked: pickedTeams.includes(team),
            'cursor-pointer':
              currentPickerId === playerName && !pickedTeams.includes(team),
          }"
          @click="selectTeam(team)"
        >
          <v-img
            :src="`https://assets.nhle.com/logos/nhl/svg/${team}_${isDarkOrLight}.svg`"
            class="pa-3"
            height="80"
            contain
          />
        </v-card>
      </v-col>
    </v-row>
    <v-row class="mt-10" justify="center">
      <v-btn @click="resetTeams"> Reset All Teams (Test Only) </v-btn>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  getDraftPlayers,
  getDraftState,
  selectTeamForPlayer,
  updateDraftState,
  resetAllPlayerTeams,
} from '../services/dynamodbService';
import {
  initSocket,
  closeSocket,
  clearSocketHandlers,
  sendSocketMessage,
  useSocket,
} from '@/services/socketClient';
import { useThemeStore } from '@/store/themeStore';
import PlayerCard from '@/components/PlayerCard.vue';

const { isConnected, lastMessage } = useSocket();

const isDisconnected = ref(false);
watch(isConnected, (newVal) => {
  isDisconnected.value = !newVal;
});

watch(lastMessage, (data) => {
  if (data?.type === 'draftUpdate') {
    draftState.value = data.payload;
    loadInitialData(); // optional
  }
});

const themeStore = useThemeStore();
const isDarkOrLight = ref(themeStore.isDarkTheme ? 'dark' : 'light');
watch(
  () => themeStore.isDarkTheme,
  (newVal) => {
    isDarkOrLight.value = newVal ? 'dark' : 'light';
  },
  { immediate: true }
);

const route = useRoute();
const playerName = route.params.name;
const currentPlayer = ref(null);

const allPlayersData = ref([]);
const currentPickerId = ref('');
const draftState = ref(null);
const availableTeams = ref([]);
const nhlTeams = ref([
  'ANA',
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
  'UTA',
  'VAN',
  'VGK',
  'WSH',
  'WPG',
]);

const currentPicker = computed(() =>
  allPlayersData.value.find((player) => {
    return player.id === currentPickerId.value;
  })
);

// Fetch initial data from backend
async function loadInitialData() {
  try {
    allPlayersData.value = await getDraftPlayers();
    draftState.value = await getDraftState();
    availableTeams.value = draftState.value.availableTeams;

    allPlayersData.value.forEach((player) => {
      if (player.name == playerName) {
        currentPlayer.value = player;
      }
    });

    currentPickerId.value = draftState.value.currentPicker;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

watch(lastMessage, (data) => {
  console.log('🚀 ~ watch ~ data:', data);
  if (data?.type === 'draftUpdate') {
    draftState.value = data.payload;
    loadInitialData(); // or use patching for better perf
  }
});

onMounted(() => {
  initSocket();
  loadInitialData();
});

onBeforeUnmount(() => {
  closeSocket();
  clearSocketHandlers();
});

// Team selection logic (only when it's player's turn)
async function selectTeam(team) {
  if (
    !currentPlayer.value ||
    currentPlayer.value.id !== currentPickerId.value
  ) {
    alert("It's not your turn!");
    return;
  }

  try {
    // Step 1: Add selected team to the player's list
    await selectTeamForPlayer(currentPlayer.value.id, team);

    // Step 2: Remove team from available list
    const updatedTeams = availableTeams.value.filter((t) => t !== team);

    // Step 3: Rotate to the next player
    const pickOrder = draftState.value.pickOrder;
    const currentIndex = pickOrder.indexOf(currentPickerId.value);
    const nextIndex = (currentIndex + 1) % pickOrder.length;
    const nextPicker = pickOrder[nextIndex];

    // Step 4: Update draft state
    await updateDraftState({
      availableTeams: updatedTeams,
      currentPicker: nextPicker,
      currentPickNumber: draftState.value.currentPickNumber + 1,
    });
    const updatedState = await getDraftState(); // re-fetch full state
    sendSocketMessage('default', updatedState); // 🔥 broadcast

    await loadInitialData(); // refresh everything
  } catch (error) {
    console.error('Error selecting team:', error);
    alert('Something went wrong.');
  }
}

// Computed property to grayscale picked teams
const pickedTeams = computed(() => {
  const picked = allPlayersData.value.flatMap((player) => player.teams || []);
  return picked;
});

// Reset teams (for testing)
async function resetTeams() {
  const confirmed = confirm('Are you sure you want to reset all teams?');

  if (!confirmed) return;

  try {
    await resetAllPlayerTeams();
    await loadInitialData(); // refresh players and teams
    await updateDraftState({
      draftStarted: false,
      pickOrder: [],
      currentPicker: null,
      currentPickNumber: 0,
      availableTeams: [...nhlTeams.value],
    });
    alert('Teams have been reset.');
  } catch (error) {
    alert('Failed to reset teams.');
  }
}

// Utility function to shuffle an array
function shuffle(array) {
  let currentIndex = array.length;
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

async function startDraft() {
  try {
    const players = await getDraftPlayers();
    const shuffled = shuffle(players.map((p) => p.id));

    const newState = {
      pickOrder: shuffled,
      currentPicker: shuffled[0],
      currentPickNumber: 1,
      draftStarted: true, // ✅ Flag the draft as started
    };

    await updateDraftState(newState);
    const updatedState = await getDraftState();

    sendSocketMessage('default', updatedState); // broadcast to all clients
    await loadInitialData(); // refresh local view
  } catch (error) {
    console.error('Failed to start draft:', error);
    alert('Could not start the draft.');
  }
}

const orderedPlayers = computed(() => {
  if (!draftState.value?.pickOrder?.length) return allPlayersData.value;

  return draftState.value.pickOrder
    .map((id) => allPlayersData.value.find((p) => p.id === id))
    .filter(Boolean);
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.picked {
  filter: grayscale(100%);
  opacity: 0.5;
  pointer-events: none;
}
.border-success {
  border-color: #4caf50 !important;
}
.border-primary {
  border-color: #2196f3 !important;
}
</style>
