// src/services/playersService.js
const API_BASE = process.env.VUE_APP_API_BASE;

export async function getAllPlayers() {
  const res = await fetch(`${API_BASE}/players`);
  if (!res.ok) throw new Error('Failed to fetch players');
  return res.json();
}

export async function getPlayerData(name) {
  const res = await fetch(`${API_BASE}/players/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Failed to fetch player');
  return res.json();
}

export async function getGameRecords() {
  const res = await fetch(`${API_BASE}/game-records`);
  if (!res.ok) throw new Error('Failed to fetch game records');
  return res.json();
}

export async function getDraftState() {
  const res = await fetch(`${API_BASE}/draft/state`);
  if (!res.ok) throw new Error('Failed to fetch draft state');
  return res.json();
}

export async function updateDraftState(patch) {
  const res = await fetch(`${API_BASE}/draft/state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update draft state');
  return res.json();
}
