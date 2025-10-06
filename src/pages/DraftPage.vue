<template>
  <transition name="fade">
    <v-alert
      v-if="isDisconnected"
      type="warning"
      class="fixed m-auto w-full text-center mb-4 z-50"
    >
      Disconnected. Trying to reconnect...
    </v-alert>
  </transition>
  <transition name="fade">
    <v-alert
      v-if="isYourTurn && !isDraftOver"
      type="success"
      class="fixed m-auto w-full text-center mb-4 z-50"
      closable
    >
      It's your turn to pick a team!
    </v-alert>
  </transition>
  <transition name="fade">
    <v-alert
      v-if="showIsNotYourTurn"
      type="error"
      class="fixed m-auto w-full text-center mb-4 z-50"
      closable
    >
      It's not your turn!
    </v-alert>
  </transition>
  <v-container class="max-w-screen-lg">
    <template v-if="isLoading">
      <div class="flex justify-center items-center mt-10">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>
    </template>
    <template v-else>
      <div v-if="isDraftOver">
        <h1 class="text-4xl font-bold mb-10">Draft is Over</h1>
        <v-row
          v-for="player in orderedPlayers"
          :key="player.playerId"
          cols="6"
          sm="3"
          justify="center"
          class="text-center mb-4"
        >
          <PlayerCard
            :player="player"
            image-type="Happy"
            :show-team-logo="false"
          />
          <div
            class="flex flex-row items-center justify-center m-4 flex-wrap md:flex-nowrap"
          >
            <div
              v-for="team in player.teams"
              :key="team"
              class="flex justify-center mb-2 md:mb-0"
            >
              <TeamLogo :team="team" width="70" height="70" />
            </div>
          </div>
        </v-row>
      </div>

      <div v-else>
        <v-col
          class="text-center mb-8"
          justify="center"
          v-if="draftState?.draftStarted"
        >
          <h1 class="text-4xl font-bold mb-4">Draft in Progress</h1>
          <div class="text-subtitle-1">
            <span v-if="currentPicker">
              Current Pick:
              <strong>{{ currentPicker.name }}</strong>
            </span>
          </div>
        </v-col>

        <div v-if="!draftState?.draftStarted" class="text-center my-8">
          <h1 class="text-4xl font-bold mb-4">Draft Not Started</h1>
          <p class="text-lg mb-4">The draft has not been started yet.</p>
          <div class="flex justify-center">
            <v-progress-circular
              indeterminate
              color="primary"
              size="24"
              width="3"
              class="mr-2"
            />
            <span class="text-sm"> Waiting for draft to start... </span>
          </div>
        </div>

        <v-row class="mb-10" dense>
          <v-col
            v-for="player in orderedPlayers"
            :key="player.playerId"
            cols="12"
            sm="6"
            md="3"
            class="text-center"
          >
            <PlayerCard
              :player="player"
              image-type="Happy"
              :show-team-logo="false"
              class="border-4"
              :class="{
                'border-success': currentPickerId === player.id,
                'border-primary':
                  !isYourTurn &&
                  player.name.toLowerCase() === playerName.toLowerCase(),
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
                <TeamLogo :team="team" />
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
              class="w-full p-4 flex items-center justify-center"
              :class="{
                picked: pickedTeams.includes(team),
                'cursor-pointer':
                  currentPickerId === playerName && !pickedTeams.includes(team),
              }"
              @click="selectTeam(team)"
            >
              <TeamLogo :team="team" width="100" height="100" />
            </v-card>
          </v-col>
        </v-row>
      </div>
    </template>
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
} from '../services/dynamodbService';
import {
  initSocket,
  closeSocket,
  clearSocketHandlers,
  sendSocketMessage,
  useSocket,
} from '@/services/socketClient';
import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';
import successSoundFile from '@/assets/sounds/woohoo_success.mp3';
import errorSoundFile from '@/assets/sounds/doh_error.mp3';

const { isConnected, lastMessage } = useSocket();
const isLoading = ref(true);

const isDisconnected = ref(false);
watch(isConnected, (newVal) => {
  isDisconnected.value = !newVal;
});

watch(lastMessage, (data) => {
  if (data?.type === 'draftUpdate') {
    draftState.value = data.payload;
    // Update available teams and current picker from the new state
    availableTeams.value = data.payload.availableTeams || [];
    currentPickerId.value = data.payload.currentPicker;

    // Recalculate if it's the current player's turn
    if (currentPlayer.value) {
      isYourTurn.value = currentPlayer.value.id === currentPickerId.value;
    }

    // If draft just started and we don't have player data yet, reload it
    if (data.payload.draftStarted && allPlayersData.value.length === 0) {
      loadInitialData();
    }

    console.log('🚀 ~ Draft state updated via socket:', data.payload);
  }
});

const showIsNotYourTurn = ref(false);
// Initialize audio objects with imported files
const successSound = new Audio(successSoundFile);
const errorSound = new Audio(errorSoundFile);
const audioReady = ref(false);

// Call this function on user interaction to preload audio
function preloadAudio() {
  successSound.load();
  errorSound.load();
  audioReady.value = true;
}

const route = useRoute();
const playerName = route.params.name;
const currentPlayer = ref(null);

const allPlayersData = ref([]);
const currentPickerId = ref('');
const draftState = ref(null);
const availableTeams = ref([]);
const isYourTurn = ref(false);
const isDraftOver = ref(false);
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
    console.log('🚀 ~ loadInitialData ~ draftState.value:', draftState.value);
    availableTeams.value = draftState.value.availableTeams;

    allPlayersData.value.forEach((player) => {
      if (player.name.toLowerCase() === playerName.toLowerCase()) {
        currentPlayer.value = player;
      }
    });
    if (!currentPlayer.value) {
      alert('Player not found. Please check your URL.');
      isLoading.value = false;
      return;
    }

    currentPickerId.value = draftState.value.currentPicker;
    isYourTurn.value = currentPlayer?.value.id === currentPickerId.value;
    isLoading.value = false;
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

watch(availableTeams, (newVal) => {
  if (newVal.length === 0) {
    isDraftOver.value = true;
  }
});

// Watch for draft state changes to update UI reactively
watch(
  () => draftState.value?.draftStarted,
  (newVal, oldVal) => {
    // If draft just started, play success sound and show notification
    if (newVal && !oldVal && audioReady.value) {
      successSound.play();
      console.log('🎉 Draft has started!');
    }
  }
);

// Watch for current picker changes to update turn status
watch(
  () => draftState.value?.currentPicker,
  (newPickerId) => {
    if (newPickerId && currentPlayer.value) {
      const wasYourTurn = isYourTurn.value;
      isYourTurn.value = currentPlayer.value.id === newPickerId;

      // If it just became this player's turn, play sound
      if (isYourTurn.value && !wasYourTurn && audioReady.value) {
        successSound.play();
      }
    }
  }
);

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
  if (!audioReady.value) {
    preloadAudio(); // preload audio on user interaction
  }
  if (
    !currentPlayer.value ||
    currentPlayer.value.id !== currentPickerId.value
  ) {
    showIsNotYourTurn.value = true;
    if (audioReady.value) {
      errorSound.play();
    }
    setTimeout(() => {
      showIsNotYourTurn.value = false;
    }, 3000);
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

const orderedPlayers = computed(() => {
  if (!draftState.value?.pickOrder?.length) return allPlayersData.value;

  return draftState.value.pickOrder
    .map((id) => allPlayersData.value.find((p) => p.id === id))
    .filter(Boolean);
});

watch(isYourTurn, (newVal) => {
  if (newVal && audioReady.value) {
    successSound.play();
  }
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
