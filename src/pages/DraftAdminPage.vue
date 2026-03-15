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
  <v-snackbar
    v-model="snackbar.visible"
    :color="snackbar.color"
    location="top"
    timeout="3500"
    data-test="draft-admin-snackbar"
  >
    {{ snackbar.message }}
  </v-snackbar>

  <v-container class="max-w-screen-lg">
    <v-alert
      v-if="loadError && !isLoading"
      type="error"
      class="mb-4"
      data-test="draft-admin-load-error"
    >
      {{ loadError }}
    </v-alert>
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
                  data-test="draft-admin-start"
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
                  data-test="draft-admin-advance"
                  block
                >
                  Advance Draft
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="4" class="text-center">
                <v-btn
                  @click="openResetDialog"
                  color="error"
                  size="large"
                  data-test="draft-admin-reset"
                  block
                >
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

    <v-dialog
      v-model="resetDialogVisible"
      max-width="480"
      data-test="draft-admin-reset-dialog"
    >
      <v-card>
        <v-card-title class="text-h6">Reset Draft?</v-card-title>
        <v-card-text>
          This will clear all drafted teams and reset draft state.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            data-test="draft-admin-reset-cancel"
            @click="resetDialogVisible = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            data-test="draft-admin-reset-confirm"
            @click="confirmResetTeams"
          >
            Reset
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import {
  getDraftPlayers,
  getDraftState,
  selectTeamForPlayer,
  updateDraftState,
  resetAllPlayerTeams,
} from '../services/dynamodbService';
import { ApiClientError } from '@/services/apiClient';
import { sendSocketMessage } from '@/services/socketClient';
import { useDraftRealtime } from '@/composables/useDraftRealtime';
import { useSeasonStore } from '@/store/seasonStore';
import PlayerCard from '@/components/PlayerCard.vue';
import TeamLogo from '@/components/TeamLogo.vue';

const isLoading = ref(true);
const loadError = ref('');
const resetDialogVisible = ref(false);
const seasonStore = useSeasonStore();
const snackbar = ref({
  visible: false,
  message: '',
  color: 'error',
});

function showSnackbar(message, color = 'error') {
  snackbar.value = {
    visible: true,
    message,
    color,
  };
}

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
  allPlayersData.value.find((player) => player.id === currentPickerId.value)
);

const orderedPlayers = computed(() => {
  if (!draftState.value?.pickOrder?.length) return allPlayersData.value;

  return draftState.value.pickOrder
    .map((id) => allPlayersData.value.find((p) => p.id === id))
    .filter(Boolean);
});

const { isDisconnected } = useDraftRealtime({
  onDraftUpdate(payload) {
    applyDraftStateToView(payload || draftState.value);
    loadInitialData({ showLoading: false, skipDraftState: true });
  },
});

function applyDraftStateToView(stateData) {
  if (!stateData) return;
  draftState.value = stateData;
  availableTeams.value = stateData.availableTeams || [];
  currentPickerId.value = stateData.currentPicker || '';
}

async function patchDraftStateWithVersion(patch) {
  const currentVersion = Number(draftState.value?.version);
  if (!Number.isInteger(currentVersion) || currentVersion < 0) {
    throw new Error('Draft state version is unavailable. Refresh and retry.');
  }

  try {
    const updatedState = await updateDraftState(
      {
        ...patch,
        version: currentVersion,
      },
      {
        season: seasonStore.currentSeason,
      }
    );
    applyDraftStateToView(updatedState);
    return updatedState;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 409) {
      applyDraftStateToView(error.details?.currentState || null);
      showSnackbar(
        'Draft changed in another session. Loaded the latest state.',
        'warning'
      );
      return null;
    }
    throw error;
  }
}

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
    loadError.value = '';
  } catch (error) {
    console.error('Error fetching data:', error);
    loadError.value = 'Unable to load draft admin data right now.';
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

onMounted(() => {
  loadInitialData();
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
    const players = await getDraftPlayers({
      season: seasonStore.currentSeason,
    });
    const shuffled = shuffle(players.map((p) => p.id));

    const newState = {
      pickOrder: shuffled,
      currentPicker: shuffled[0],
      currentPickNumber: 1,
      draftStarted: true,
    };

    const updatedState = await patchDraftStateWithVersion(newState);
    if (!updatedState) {
      return;
    }

    sendSocketMessage('default', updatedState);
    await loadInitialData({ showLoading: false });
    showSnackbar('Draft started successfully.', 'success');
  } catch (error) {
    console.error('Failed to start draft:', error);
    showSnackbar('Could not start the draft.', 'error');
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

      await selectTeamForPlayer(currentPickerId.value, randomTeam, {
        season: seasonStore.currentSeason,
      });

      const updatedTeams = availableTeams.value.filter((t) => t !== randomTeam);

      const updatedState = await patchDraftStateWithVersion({
        availableTeams: updatedTeams,
        currentPicker: nextPicker,
        currentPickNumber: draftState.value.currentPickNumber + 1,
      });
      if (!updatedState) {
        return;
      }
    } else {
      const updatedState = await patchDraftStateWithVersion({
        currentPicker: nextPicker,
        currentPickNumber: draftState.value.currentPickNumber + 1,
      });
      if (!updatedState) {
        return;
      }
    }

    sendSocketMessage('default', draftState.value);
    await loadInitialData({ showLoading: false });
  } catch (error) {
    console.error('Failed to advance draft:', error);
    showSnackbar('Could not advance the draft.', 'error');
  }
}

function openResetDialog() {
  resetDialogVisible.value = true;
}

async function confirmResetTeams() {
  try {
    await resetAllPlayerTeams({ season: seasonStore.currentSeason });
    const updatedState = await patchDraftStateWithVersion({
      draftStarted: false,
      pickOrder: [],
      currentPicker: null,
      currentPickNumber: 0,
      availableTeams: [...nhlTeams.value],
    });
    if (!updatedState) {
      return;
    }
    sendSocketMessage('default', updatedState);
    await loadInitialData({ showLoading: false });
    isDraftOver.value = false;
    resetDialogVisible.value = false;
    showSnackbar('Teams have been reset.', 'success');
  } catch (error) {
    console.error('Failed to reset teams:', error);
    showSnackbar('Failed to reset teams.', 'error');
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
