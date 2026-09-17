<template>
  <aside class="preview-controls" aria-label="Design preview controls">
    <strong>DESIGN PREVIEW · SAMPLE DATA</strong
    ><span>Changes stay in local memory. Reset restores the fixture.</span>
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
  try {
    const response = await fetch('http://localhost:8091/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!response.ok) throw Error('Preview update failed');
    error.value = '';
    if (action === 'reset') sessionStorage.removeItem('arcade-finished-games');
    if (action === 'reset' || action === 'owners') {
      location.reload();
      return;
    }
    window.dispatchEvent(new Event('arcade-preview-refresh'));
  } catch (e) {
    error.value = e.message;
  }
}
onMounted(async () => {
  try {
    const response = await fetch('http://localhost:8091/api/players');
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
.preview-controls label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.preview-controls p {
  margin: 8px 0;
}
</style>
