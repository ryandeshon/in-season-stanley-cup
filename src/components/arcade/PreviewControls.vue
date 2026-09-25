<template>
  <DraftTestControls v-if="testDraftEnabled" />
  <aside v-else class="preview-controls" aria-label="Design preview controls">
    <strong>DESIGN PREVIEW · SAMPLE DATA</strong
    ><span
      >Sample data only. Scenarios stay in this browser. Reset restores the live
      game.</span
    >
    <div>
      <a v-if="testDraftApiBase" href="/draft/admin?draftTest=1"
        >Test the draft and WebSockets ↗</a
      >
    </div>
    <div aria-label="Game scenarios">
      <strong>Game scenario</strong>
      <button
        v-for="option in scenarios"
        :key="option[0]"
        :aria-pressed="scenario === option[0]"
        @click="send('scenario', { scenario: option[0] })"
      >
        {{ option[1] }}
      </button>
    </div>
    <div>
      <label
        >Left owner
        <select v-model="left" @change="owners">
          <option v-for="name in names" :key="name">{{ name }}</option>
        </select></label
      ><label
        >Right owner
        <select v-model="right" @change="owners">
          <option v-for="name in names" :key="name">{{ name }}</option>
        </select></label
      ><button
        v-for="action in actions"
        :key="action[0]"
        :disabled="
          ['off-day', 'empty-schedule'].includes(scenario) &&
          !['reset', 'live'].includes(action[0])
        "
        @click="send(action[0])"
      >
        {{ action[1] }}
      </button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </aside>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import DraftTestControls from './DraftTestControls.vue';
import {
  previewBase,
  testDraftEnabled,
  testDraftApiBase,
} from '@/utilities/previewConfig';
const scenario = ref('live');
const scenarios = [
  ['live', 'Live game'],
  ['pregame', 'Pregame'],
  ['off-day', 'Off day'],
  ['empty-schedule', 'No upcoming games'],
];
const names = ['Ryan', 'Cooper', 'Boz', 'Terry'];
const left = ref('Ryan'),
  right = ref('Cooper'),
  error = ref('');
const actions = [
  ['goal-home', 'BOS goal'],
  ['goal-away', 'TOR goal'],
  ['live', 'Go live'],
  ['intermission', 'Intermission'],
  ['final', 'Final'],
  ['shutout', 'Shutout final'],
  ['reset', 'Reset'],
];
async function send(action, extra = {}) {
  if (action === 'live' && scenario.value !== 'live') {
    action = 'scenario';
    extra = { scenario: 'live' };
  }
  try {
    const response = await fetch(`${previewBase}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!response.ok) throw Error('Preview update failed');
    error.value = '';
    if (action === 'reset' || action === 'scenario')
      sessionStorage.removeItem('arcade-finished-games');
    if (action === 'reset' || action === 'owners' || action === 'scenario') {
      location.reload();
      return;
    }
    window.dispatchEvent(new Event('arcade-preview-refresh'));
  } catch (e) {
    error.value = e.message;
  }
}
onMounted(async () => {
  if (testDraftEnabled) return;
  try {
    const status = await fetch(`${previewBase}/preview`);
    if (status.ok) scenario.value = (await status.json()).scenario;
    const response = await fetch(`${previewBase}/api/players`);
    if (!response.ok) throw Error('Preview owners unavailable');
    const players = await response.json();
    left.value = players.find((p) => p.teams.includes('BOS'))?.name || 'Ryan';
    right.value =
      players.find((p) => p.teams.includes('TOR'))?.name || 'Cooper';
  } catch (e) {
    error.value = e.message;
  }
});
function owners() {
  send('owners', { left: left.value, right: right.value });
}
</script>
<style scoped>
.preview-controls {
  background: #252217;
  border-bottom: 1px solid #8b7745;
  color: #ead9a2;
  padding: 12px 20px;
  font:
    12px/1.5 Arial,
    sans-serif;
}
.preview-controls strong {
  margin-right: 14px;
}
.preview-controls > div {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 10px;
}
.preview-controls button,
.preview-controls select {
  min-height: 36px;
  padding: 5px 10px;
  border: 1px solid #847851;
  background: #181b16;
  color: #f2e5bf;
}
.preview-controls button[aria-pressed='true'] {
  background: #ead9a2;
  color: #181b16;
}
.preview-controls button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.preview-controls label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.preview-controls p {
  margin: 8px 0;
}
</style>
