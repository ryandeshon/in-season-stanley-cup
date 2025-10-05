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

  <v-container class="max-w-screen-lg">
    <template v-if="isLoading">
      <div class="flex justify-center items-center mt-10">
        <v-progress-circular indeterminate color="primary" />
      </div>
    </template>
    <template v-else>
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-4">Draft Admin Panel</h1>
        <p class="text-lg mb-8">Administrative tools for managing the draft</p>
      </div>

      <v-row justify="center" class="mb-8">
        <v-col cols="12" md="8">
          <v-card class="pa-6">
            <v-card-title class="text-xl font-bold mb-4">
              Draft Controls
            </v-card-title>

            <div class="mb-6">
              <h3 class="text-lg font-semibold mb-2">Draft Status</h3>
              <v-chip
                :color="draftState?.draftStarted ? 'success' : 'warning'"
                class="mr-2"
              >
                {{ draftState?.draftStarted ? 'In Progress' : 'Not Started' }}
              </v-chip>
              <v-chip v-if="currentPicker" color="primary">
                Current Pick: {{ currentPicker.name }}
              </v-chip>
            </div>

            <v-row class="mb-4" justify="center">
              <v-col cols="12" sm="6" md="4" class="text-center">
                <v-btn
                  @click="startDraft"
                  color="success"
                  size="large"
                  :disabled="draftState?.draftStarted"
                  block
                >
                  Start Draft
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="4" class="text-center">
                <v-btn
                  @click="advanceDraft"
                  color="primary"
                  size="large"
                  :disabled="!draftState?.draftStarted || isDraftOver"
                  block
                >
                  Advance Draft
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="4" class="text-center">
                <v-btn @click="resetTeams" color="error" size="large" block>
                  Reset Draft
                </v-btn>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>

      <v-row justify="center" class="mb-8">
        <v-col cols="12" md="8">
          <v-card class="pa-6">
            <v-card-title class="text-xl font-bold mb-4">
              Draft Progress
            </v-card-title>

            <div v-if="draftState?.draftStarted">
              <p class="mb-4">
                <strong>Pick Number:</strong>
                {{ draftState.currentPickNumber || 0 }}
              </p>
              <p class="mb-4">
                <strong>Teams Remaining:</strong> {{ availableTeams.length }}
              </p>

              <h4 class="text-lg font-semibold mb-2">Pick Order:</h4>
              <v-chip-group column>
                <v-chip
                  v-for="(playerId, index) in draftState.pickOrder"
                  :key="playerId"
                  :color="playerId === currentPickerId ? 'primary' : 'default'"
                  :variant="
                    playerId === currentPickerId ? 'elevated' : 'outlined'
                  "
                >
                  {{ index + 1 }}. {{ getPlayerName(playerId) }}
                </v-chip>
              </v-chip-group>
            </div>
            <div v-else>
              <p>Draft has not been started yet.</p>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-row justify="center">
        <v-col cols="12" md="10">
          <v-card class="pa-6">
            <v-card-title class="text-xl font-bold mb-4">
              Current Player Status
            </v-card-title>

            <v-row dense>
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
                    'border-warning': player.teams?.length === 0,
                  }"
                />
                <div class="text-caption my-2 font-italic">
                  Selected Teams ({{ player.teams?.length || 0 }}):
                </div>
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
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
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
import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';

const { isConnected, lastMessage } = useSocket();
const isLoading = ref(true);

const isDisconnected = ref(false);
watch(isConnected, (newVal) => {
  isDisconnected.value = !newVal;
});

watch(lastMessage, (data) => {
  if (data?.type === 'draftUpdate') {
    draftState.value = data.payload;
    loadInitialData();
  }
});

const allPlayersData = ref([]);
const currentPickerId = ref('');
const draftState = ref(null);
const availableTeams = ref([]);
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

const orderedPlayers = computed(() => {
  if (!draftState.value?.pickOrder?.length) return allPlayersData.value;

  return draftState.value.pickOrder
    .map((id) => allPlayersData.value.find((p) => p.id === id))
    .filter(Boolean);
});

async function loadInitialData() {
  try {
    allPlayersData.value = await getDraftPlayers();
    draftState.value = await getDraftState();
    availableTeams.value = draftState.value.availableTeams;
    currentPickerId.value = draftState.value.currentPicker;
    isLoading.value = false;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

watch(lastMessage, (data) => {
  if (data?.type === 'draftUpdate') {
    draftState.value = data.payload;
    loadInitialData();
  }
});

watch(availableTeams, (newVal) => {
  if (newVal.length === 0) {
    isDraftOver.value = true;
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

function getPlayerName(playerId) {
  const player = allPlayersData.value.find((p) => p.id === playerId);
  return player ? player.name : playerId;
}

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
      draftStarted: true,
    };

    await updateDraftState(newState);
    const updatedState = await getDraftState();

    sendSocketMessage('default', updatedState);
    await loadInitialData();
  } catch (error) {
    console.error('Failed to start draft:', error);
    alert('Could not start the draft.');
  }
}

async function advanceDraft() {
  try {
    const pickOrder = draftState.value.pickOrder;
    const currentIndex = pickOrder.indexOf(currentPickerId.value);
    const nextIndex = (currentIndex + 1) % pickOrder.length;
    const nextPicker = pickOrder[nextIndex];

    if (availableTeams.value.length > 0) {
      const randomTeamIndex = Math.floor(
        Math.random() * availableTeams.value.length
      );
      const randomTeam = availableTeams.value[randomTeamIndex];

      await selectTeamForPlayer(currentPickerId.value, randomTeam);

      const updatedTeams = availableTeams.value.filter((t) => t !== randomTeam);

      await updateDraftState({
        availableTeams: updatedTeams,
        currentPicker: nextPicker,
        currentPickNumber: draftState.value.currentPickNumber + 1,
      });
    } else {
      await updateDraftState({
        currentPicker: nextPicker,
        currentPickNumber: draftState.value.currentPickNumber + 1,
      });
    }

    const updatedState = await getDraftState();
    sendSocketMessage('default', updatedState);
    await loadInitialData();
  } catch (error) {
    console.error('Failed to advance draft:', error);
    alert('Could not advance the draft.');
  }
}

async function resetTeams() {
  const confirmed = confirm('Are you sure you want to reset all teams?');

  if (!confirmed) return;

  try {
    await resetAllPlayerTeams();
    await updateDraftState({
      draftStarted: false,
      pickOrder: [],
      currentPicker: null,
      currentPickNumber: 0,
      availableTeams: [...nhlTeams.value],
    });
    await loadInitialData();
    isDraftOver.value = false;
    alert('Teams have been reset.');
  } catch (error) {
    alert('Failed to reset teams.');
  }
}
</script>

<style scoped>
.border-success {
  border-color: #4caf50 !important;
}
.border-warning {
  border-color: #ff9800 !important;
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
