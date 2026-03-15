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
  <transition name="fade">
    <v-alert
      v-if="draftState?.isLocked && draftState?.draftStarted"
      type="warning"
      class="fixed m-auto w-full text-center mb-4 z-50"
      data-test="draft-player-locked-banner"
    >
      Draft is locked by an admin.
    </v-alert>
  </transition>
  <v-snackbar
    v-model="snackbar.visible"
    :color="snackbar.color"
    location="top"
    timeout="3500"
    data-test="draft-player-snackbar"
  >
    {{ snackbar.message }}
  </v-snackbar>
  <v-container class="max-w-screen-lg">
    <v-alert
      v-if="loadError && !isLoading"
      type="error"
      class="mb-4"
      data-test="draft-player-load-error"
    >
      {{ loadError }}
    </v-alert>
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
          <div class="mt-2">
            <v-chip
              :color="draftState?.isLocked ? 'warning' : 'success'"
              size="small"
              class="mr-2"
            >
              {{ draftState?.isLocked ? 'Locked' : 'Unlocked' }}
            </v-chip>
            <v-chip
              v-if="showAutoPickCountdown"
              color="primary"
              size="small"
              data-test="draft-player-autopick-countdown"
            >
              Auto-pick in {{ autoPickCountdownLabel }}
            </v-chip>
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
              :data-test="`draft-team-card-${team}`"
              :class="{
                picked: pickedTeams.includes(team),
                'cursor-pointer':
                  isYourTurn && !pickedTeams.includes(team) && !isDraftLocked,
                'locked-card': isDraftLocked,
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import {
  getDraftPlayers,
  getDraftState,
  makeDraftPick,
} from '../services/dynamodbService';
import { ApiClientError } from '@/services/apiClient';
import { sendSocketMessage } from '@/services/socketClient';
import { useDraftRealtime } from '@/composables/useDraftRealtime';
import { useSeasonStore } from '@/store/seasonStore';
import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';
import successSoundFile from '@/assets/sounds/woohoo_success.mp3';
import errorSoundFile from '@/assets/sounds/doh_error.mp3';

const isLoading = ref(true);
const loadError = ref('');
const showIsNotYourTurn = ref(false);
const snackbar = ref({
  visible: false,
  message: '',
  color: 'error',
});

// Initialize audio objects with imported files
const successSound = new Audio(successSoundFile);
const errorSound = new Audio(errorSoundFile);
const audioReady = ref(false);

function showSnackbar(message, color = 'error') {
  snackbar.value = {
    visible: true,
    message,
    color,
  };
}

// Call this function on user interaction to preload audio
function preloadAudio() {
  successSound.load();
  errorSound.load();
  audioReady.value = true;
}

const route = useRoute();
const seasonStore = useSeasonStore();
const playerName = route.params.name;
const currentPlayer = ref(null);

const allPlayersData = ref([]);
const currentPickerId = ref('');
const draftState = ref(null);
const availableTeams = ref([]);
const isYourTurn = ref(false);
const isDraftOver = ref(false);
const nowMs = ref(Date.now());
let countdownIntervalId = null;
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
  allPlayersData.value.find((player) => player.id === currentPickerId.value)
);

const isDraftLocked = computed(() => Boolean(draftState.value?.isLocked));

const autoPickSecondsRemaining = computed(() => {
  if (!draftState.value?.autoPickEnabled) return null;
  const deadlineAt = Date.parse(draftState.value.autoPickDeadlineAt || '');
  if (!Number.isFinite(deadlineAt)) return null;
  return Math.max(0, Math.ceil((deadlineAt - nowMs.value) / 1000));
});

const showAutoPickCountdown = computed(
  () =>
    Boolean(draftState.value?.draftStarted) &&
    !isDraftOver.value &&
    autoPickSecondsRemaining.value !== null
);

const autoPickCountdownLabel = computed(() => {
  const remaining = autoPickSecondsRemaining.value;
  if (remaining === null) return '--:--';
  const minutes = Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
});

const { isDisconnected } = useDraftRealtime({
  onDraftUpdate(payload) {
    applyDraftStateToView(payload || draftState.value);
    syncCurrentPlayer();
    loadInitialData({ showLoading: false, skipDraftState: true });
  },
});

function syncCurrentPlayer() {
  const foundPlayer = allPlayersData.value.find(
    (player) => player.name.toLowerCase() === String(playerName).toLowerCase()
  );
  currentPlayer.value = foundPlayer || null;
  if (!currentPlayer.value) {
    loadError.value = 'Player not found. Please check your URL.';
    showSnackbar(loadError.value, 'error');
    return false;
  }
  isYourTurn.value = currentPlayer.value.id === currentPickerId.value;
  loadError.value = '';
  return true;
}

function applyDraftStateToView(stateData) {
  if (!stateData) return;
  draftState.value = stateData;
  availableTeams.value = stateData.availableTeams || [];
  currentPickerId.value = stateData.currentPicker || '';
}

// Fetch initial data from backend
async function loadInitialData(options = {}) {
  const { showLoading = true, skipDraftState = false } = options;
  if (showLoading) {
    isLoading.value = true;
  }
  try {
    const [playersData, stateData] = await Promise.all([
      getDraftPlayers({ season: seasonStore.currentSeason }),
      skipDraftState
        ? Promise.resolve(draftState.value)
        : getDraftState({ season: seasonStore.currentSeason }),
    ]);
    allPlayersData.value = playersData || [];
    applyDraftStateToView(stateData);

    syncCurrentPlayer();
  } catch (error) {
    console.error('Error fetching data:', error);
    loadError.value = 'Unable to load draft data right now.';
    showSnackbar(loadError.value, 'error');
  } finally {
    isLoading.value = false;
  }
}

watch(
  availableTeams,
  (newVal) => {
    isDraftOver.value = newVal.length === 0;
  },
  { immediate: true }
);

// Watch for draft state changes to update UI reactively
watch(
  () => draftState.value?.draftStarted,
  (newVal, oldVal) => {
    // If draft just started, play success sound and show notification
    if (newVal && !oldVal && audioReady.value) {
      successSound.play();
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
  loadInitialData();
  countdownIntervalId = window.setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (countdownIntervalId) {
    window.clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
});

// Team selection logic (only when it's player's turn)
async function selectTeam(team) {
  if (!audioReady.value) {
    preloadAudio(); // preload audio on user interaction
  }
  if (isDraftLocked.value) {
    showSnackbar('Draft is locked right now.', 'warning');
    return;
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
    const currentVersion = Number(draftState.value?.version);
    if (!Number.isInteger(currentVersion) || currentVersion < 0) {
      throw new Error('Draft state version is unavailable. Refresh and retry.');
    }

    const result = await makeDraftPick(
      currentPlayer.value.id,
      team,
      currentVersion,
      {
        season: seasonStore.currentSeason,
      }
    );

    const updatedState = result?.state || null;
    if (!updatedState) {
      showSnackbar(
        'Pick completed but no draft state was returned.',
        'warning'
      );
      await loadInitialData({ showLoading: false });
      return;
    }

    applyDraftStateToView(updatedState);
    syncCurrentPlayer();
    sendSocketMessage('default', updatedState); // broadcast
    await loadInitialData({ showLoading: false });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 409) {
      applyDraftStateToView(error.details?.currentState || null);
      syncCurrentPlayer();
      showSnackbar(
        'Draft changed in another session. Loaded the latest state.',
        'warning'
      );
      return;
    }
    if (error instanceof ApiClientError && error.status === 400) {
      showSnackbar(error.details?.error || 'Pick was rejected.', 'warning');
      await loadInitialData({ showLoading: false });
      return;
    }
    console.error('Error selecting team:', error);
    showSnackbar('Something went wrong while picking a team.', 'error');
  }
}

// Computed property to grayscale picked teams
const pickedTeams = computed(() =>
  allPlayersData.value.flatMap((player) => player.teams || [])
);

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
.locked-card {
  opacity: 0.7;
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
