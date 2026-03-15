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
              <v-chip
                :color="isDraftLocked ? 'warning' : 'success'"
                class="mr-2"
              >
                {{ isDraftLocked ? 'Locked' : 'Unlocked' }}
              </v-chip>
              <v-chip v-if="currentPicker" color="primary">
                Current Pick: {{ currentPicker.name }}
              </v-chip>
              <v-chip
                v-if="showAutoPickCountdown"
                color="primary"
                class="ml-2"
                data-test="draft-admin-autopick-countdown"
              >
                Auto-pick in {{ autoPickCountdownLabel }}
              </v-chip>
            </div>

            <v-row class="mb-4" justify="center">
              <v-col cols="12" sm="6" md="3" class="text-center">
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
              <v-col cols="12" sm="6" md="3" class="text-center">
                <v-btn
                  @click="advanceDraft"
                  color="primary"
                  size="large"
                  :disabled="
                    !draftState?.draftStarted || isDraftOver || isDraftLocked
                  "
                  data-test="draft-admin-advance"
                  block
                >
                  Advance Draft
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3" class="text-center">
                <v-btn
                  @click="undoLastPick"
                  color="secondary"
                  size="large"
                  :disabled="!canUndoLastPick"
                  data-test="draft-admin-undo"
                  block
                >
                  Undo Last Pick
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3" class="text-center">
                <v-btn
                  @click="toggleDraftLock"
                  :color="isDraftLocked ? 'warning' : 'info'"
                  size="large"
                  :disabled="!draftState?.draftStarted"
                  data-test="draft-admin-lock-toggle"
                  block
                >
                  {{ isDraftLocked ? 'Unlock Draft' : 'Lock Draft' }}
                </v-btn>
              </v-col>
            </v-row>
            <v-row class="mb-4" justify="center">
              <v-col cols="12" sm="8" md="6" class="text-center">
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

            <v-divider class="my-4" />
            <h3 class="text-lg font-semibold mb-2">Auto-pick Countdown</h3>
            <v-row align="center" class="mb-2">
              <v-col cols="12" md="4">
                <v-switch
                  v-model="autoPickEnabledControl"
                  color="primary"
                  hide-details
                  inset
                  label="Enable Auto-pick"
                  data-test="draft-admin-autopick-enabled"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="autoPickSecondsControl"
                  type="number"
                  min="5"
                  max="600"
                  label="Countdown (seconds)"
                  density="comfortable"
                  :disabled="!autoPickEnabledControl"
                  data-test="draft-admin-autopick-seconds"
                />
              </v-col>
              <v-col cols="12" md="4" class="text-center">
                <v-btn
                  color="primary"
                  :disabled="!draftState"
                  data-test="draft-admin-autopick-save"
                  @click="saveAutoPickConfig"
                  block
                >
                  Save Countdown
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
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import {
  getDraftPlayers,
  getDraftState,
  makeDraftPick,
  undoLastDraftPick,
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
const nowMs = ref(Date.now());
let countdownIntervalId = null;
const autoPickEnabledControl = ref(false);
const autoPickSecondsControl = ref(60);
const autoPickInFlight = ref(false);
const lastAutoPickVersionAttempt = ref(null);
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
const canUndoLastPick = computed(() =>
  Boolean(draftState.value?.pickHistory?.length)
);

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
  const previousVersion = Number(draftState.value?.version);
  const nextVersion = Number(stateData.version);
  if (previousVersion !== nextVersion) {
    lastAutoPickVersionAttempt.value = null;
  }
  draftState.value = stateData;
  availableTeams.value = stateData.availableTeams || [];
  currentPickerId.value = stateData.currentPicker || '';
  autoPickEnabledControl.value = Boolean(stateData.autoPickEnabled);
  autoPickSecondsControl.value = Number.isInteger(
    Number(stateData.autoPickSeconds)
  )
    ? Number(stateData.autoPickSeconds)
    : 60;
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

function normalizeAutoPickSeconds(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 5) return 60;
  return Math.min(parsed, 600);
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

watch(autoPickSecondsRemaining, (remainingSeconds) => {
  if (remainingSeconds !== 0) return;
  triggerAutoPickIfNeeded();
});

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
    const autoPickSeconds = normalizeAutoPickSeconds(
      autoPickSecondsControl.value
    );
    autoPickSecondsControl.value = autoPickSeconds;

    const newState = {
      pickOrder: shuffled,
      currentPicker: shuffled[0],
      currentPickNumber: 1,
      draftStarted: true,
      isLocked: false,
      availableTeams: [...nhlTeams.value],
      pickHistory: [],
      autoPickEnabled: autoPickEnabledControl.value,
      autoPickSeconds,
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

async function advanceDraft(options = {}) {
  const { isAutoPick = false } = options;
  try {
    if (!draftState.value?.draftStarted || isDraftOver.value) {
      return;
    }
    if (isDraftLocked.value) {
      if (!isAutoPick) {
        showSnackbar('Draft is locked. Unlock to advance picks.', 'warning');
      }
      return;
    }
    if (!availableTeams.value.length) {
      return;
    }

    const currentVersion = Number(draftState.value?.version);
    if (!Number.isInteger(currentVersion) || currentVersion < 0) {
      throw new Error('Draft state version is unavailable. Refresh and retry.');
    }

    const randomTeamIndex = Math.floor(
      Math.random() * availableTeams.value.length
    );
    const randomTeam = availableTeams.value[randomTeamIndex];
    const result = await makeDraftPick(
      currentPickerId.value,
      randomTeam,
      currentVersion,
      {
        season: seasonStore.currentSeason,
      }
    );
    const updatedState = result?.state || null;
    if (!updatedState) {
      showSnackbar(
        'Auto-pick completed but no state payload was returned.',
        'warning'
      );
      await loadInitialData({ showLoading: false });
      return;
    }
    applyDraftStateToView(updatedState);

    sendSocketMessage('default', updatedState);
    await loadInitialData({ showLoading: false });
    if (!isAutoPick) {
      showSnackbar('Advanced to the next draft pick.', 'success');
    }
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 409) {
      applyDraftStateToView(error.details?.currentState || null);
      showSnackbar(
        'Draft changed in another session. Loaded the latest state.',
        'warning'
      );
      return;
    }
    if (error instanceof ApiClientError && error.status === 400) {
      showSnackbar(
        error.details?.error || 'Could not advance the draft.',
        'warning'
      );
      await loadInitialData({ showLoading: false });
      return;
    }
    console.error('Failed to advance draft:', error);
    showSnackbar(
      isAutoPick
        ? 'Auto-pick failed to advance.'
        : 'Could not advance the draft.',
      'error'
    );
  }
}

async function triggerAutoPickIfNeeded() {
  if (autoPickInFlight.value) return;
  if (!draftState.value?.draftStarted || isDraftOver.value) return;
  if (isDraftLocked.value || !draftState.value?.autoPickEnabled) return;

  const currentVersion = Number(draftState.value?.version);
  if (!Number.isInteger(currentVersion) || currentVersion < 0) return;
  if (lastAutoPickVersionAttempt.value === currentVersion) return;

  autoPickInFlight.value = true;
  lastAutoPickVersionAttempt.value = currentVersion;
  try {
    await advanceDraft({ isAutoPick: true });
  } finally {
    autoPickInFlight.value = false;
  }
}

async function toggleDraftLock() {
  try {
    const updatedState = await patchDraftStateWithVersion({
      isLocked: !isDraftLocked.value,
    });
    if (!updatedState) return;
    sendSocketMessage('default', updatedState);
    showSnackbar(
      updatedState.isLocked ? 'Draft locked.' : 'Draft unlocked.',
      'success'
    );
  } catch (error) {
    console.error('Failed to toggle draft lock:', error);
    showSnackbar('Could not update draft lock.', 'error');
  }
}

async function undoLastPick() {
  const currentVersion = Number(draftState.value?.version);
  if (!Number.isInteger(currentVersion) || currentVersion < 0) {
    showSnackbar('Draft version is unavailable. Refresh and retry.', 'error');
    return;
  }

  try {
    const result = await undoLastDraftPick(currentVersion, {
      season: seasonStore.currentSeason,
    });
    const updatedState = result?.state || null;
    if (!updatedState) {
      showSnackbar(
        'Undo completed but no draft state was returned.',
        'warning'
      );
      await loadInitialData({ showLoading: false });
      return;
    }

    applyDraftStateToView(updatedState);
    sendSocketMessage('default', updatedState);
    await loadInitialData({ showLoading: false });
    showSnackbar(
      `Undid pick: ${result?.undonePick?.team || 'last pick'}.`,
      'success'
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 409) {
      applyDraftStateToView(error.details?.currentState || null);
      showSnackbar(
        'Draft changed in another session. Loaded the latest state.',
        'warning'
      );
      return;
    }
    if (error instanceof ApiClientError && error.status === 400) {
      showSnackbar(
        error.details?.error || 'Could not undo the last pick.',
        'warning'
      );
      return;
    }
    console.error('Failed to undo draft pick:', error);
    showSnackbar('Could not undo the last pick.', 'error');
  }
}

async function saveAutoPickConfig() {
  try {
    const autoPickSeconds = normalizeAutoPickSeconds(
      autoPickSecondsControl.value
    );
    autoPickSecondsControl.value = autoPickSeconds;
    const updatedState = await patchDraftStateWithVersion({
      autoPickEnabled: autoPickEnabledControl.value,
      autoPickSeconds,
    });
    if (!updatedState) {
      return;
    }
    sendSocketMessage('default', updatedState);
    showSnackbar('Auto-pick countdown settings saved.', 'success');
  } catch (error) {
    console.error('Failed to save auto-pick settings:', error);
    showSnackbar('Could not save auto-pick settings.', 'error');
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
      pickHistory: [],
      isLocked: false,
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
