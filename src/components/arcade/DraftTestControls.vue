<template>
  <aside class="draft-test-controls" aria-label="Test draft controls">
    <strong>TEST DRAFT · BROWSER-LOCAL PRACTICE</strong>
    <p>
      Open Admin in one window and a player in another. Start, pick, undo, lock,
      or reset from Admin. No access codes needed. Picks are saved in this
      browser only; no database is updated.
    </p>
    <nav aria-label="Draft test pages">
      <a href="/draft/admin?draftTest=1">Admin</a>
      <a
        v-for="name in names"
        :key="name"
        :href="`/draft/${name}?draftTest=1`"
        target="_blank"
        rel="noopener"
        >{{ name }} ↗</a
      >
      <a href="/">Back to game scenarios</a>
    </nav>
    <div class="diagnostics" aria-live="polite">
      <strong data-test="test-socket-status"
        >Local sync: {{ isConnected ? 'Connected' : 'Disconnected' }}</strong
      >
      <span data-test="test-socket-events"
        >Events received: {{ draftEventCount }}</span
      >
      <span>Last event: {{ draftLastEventAt }}</span>
    </div>
    <label
      ><input v-model="draftSocketOnly" type="checkbox" /> Live updates only
      (pause polling)</label
    >
    <button @click="disconnect">Disconnect</button>
    <button @click="reconnect">Reconnect</button>
    <p>
      Tabs in the same browser and profile share this practice. Other devices
      have separate drafts. This tests the draft flow, not the real WebSocket
      server. Keep Admin open for automatic countdown picks. Reset from Admin to
      replay.
    </p>
  </aside>
</template>
<script setup>
import { useSocket, closeSocket, initSocket } from '@/services/socketClient';
import {
  draftSocketOnly,
  draftEventCount,
  draftLastEventAt,
} from '@/utilities/draftTestState';
const names = ['Ryan', 'Cooper', 'Boz', 'Terry'];
const { isConnected } = useSocket();
function disconnect() {
  closeSocket();
}
function reconnect() {
  closeSocket();
  initSocket();
}
</script>
<style scoped>
.draft-test-controls {
  padding: 16px 20px;
  background: #252217;
  color: #ead9a2;
  border-bottom: 1px solid #8b7745;
  font:
    14px/1.5 Arial,
    sans-serif;
}
nav,
.diagnostics {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 12px 0;
}
a {
  color: #fff0b6;
  text-decoration: underline;
}
button {
  margin: 8px;
  padding: 6px 12px;
  border: 1px solid #847851;
}
button:disabled {
  opacity: 0.45;
}
input {
  margin-right: 8px;
}
p {
  margin: 8px 0;
}
</style>
