// src/services/playersService.js
import { apiRequest } from '@/services/apiClient';
import {
  hydratePlayerTeam,
  hydratePlayerTeams,
} from '@/utilities/playerTeamHydration';

let adminToken = '';
export function setDraftAdminToken(value) {
  adminToken = value || '';
}
function adminHeaders() {
  return adminToken ? { 'x-admin-token': adminToken } : {};
}

function withSeasonQuery(season) {
  if (!season) return undefined;
  return { season };
}

export async function getAllPlayers(options = {}) {
  const players = await apiRequest('/players', {
    query: withSeasonQuery(options.season),
    retries: 1,
  });
  return hydratePlayerTeams(players, options.season);
}

export async function getPlayerData(name, options = {}) {
  const player = await apiRequest(`/players/${encodeURIComponent(name)}`, {
    query: withSeasonQuery(options.season),
    retries: 1,
  });
  return hydratePlayerTeam(player, options.season);
}

// Share only simultaneous reads, never a stored result. Refreshes still fetch
// current records, and forced refreshes cannot reuse an ordinary request.
const pendingGameRecords = new Map();
export function getGameRecords(options = {}) {
  const key = JSON.stringify([
    options.season || '',
    Boolean(options.bustCache),
  ]);
  if (pendingGameRecords.has(key)) return pendingGameRecords.get(key);
  const request = apiRequest('/game-records', {
    query: withSeasonQuery(options.season),
    bustCache: options.bustCache,
    retries: 1,
  }).finally(() => pendingGameRecords.delete(key));
  pendingGameRecords.set(key, request);
  return request;
}

export async function getDraftState(options = {}) {
  return apiRequest('/draft/state', {
    query: withSeasonQuery(options.season),
    retries: 1,
  });
}

export async function updateDraftState(patch, options = {}) {
  return apiRequest('/draft/state', {
    method: 'PATCH',
    headers: adminHeaders(),
    body: patch,
    query: withSeasonQuery(options.season),
  });
}

export async function getDraftPlayers(options = {}) {
  return getAllPlayers(options);
}

export async function selectTeamForPlayer(playerId, team, options = {}) {
  return apiRequest('/draft/select-team', {
    method: 'POST',
    body: { playerId, team },
    query: withSeasonQuery(options.season),
  });
}

export async function makeDraftPick(playerId, team, version, options = {}) {
  return apiRequest('/draft/pick', {
    method: 'POST',
    headers: {
      ...adminHeaders(),
      ...(options.token ? { 'x-draft-token': options.token } : {}),
    },
    body: { playerId, team, version },
    query: withSeasonQuery(options.season),
  });
}

export async function undoLastDraftPick(version, options = {}) {
  return apiRequest('/draft/undo-last-pick', {
    headers: adminHeaders(),
    method: 'POST',
    body: { version },
    query: withSeasonQuery(options.season),
  });
}

export async function resetAllPlayerTeams(options = {}) {
  return apiRequest('/players/reset-teams', {
    headers: adminHeaders(),
    method: 'POST',
    body: { version: options.version },
    query: withSeasonQuery(options.season),
  });
}
