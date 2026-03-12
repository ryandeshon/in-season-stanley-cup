// src/services/playersService.js
import { apiRequest } from '@/services/apiClient';

function withSeasonQuery(season) {
  if (!season) return undefined;
  return { season };
}

export async function getAllPlayers(options = {}) {
  return apiRequest('/players', {
    query: withSeasonQuery(options.season),
    retries: 1,
  });
}

export async function getPlayerData(name, options = {}) {
  return apiRequest(`/players/${encodeURIComponent(name)}`, {
    query: withSeasonQuery(options.season),
    retries: 1,
  });
}

export async function getGameRecords(options = {}) {
  return apiRequest('/game-records', {
    query: withSeasonQuery(options.season),
    retries: 1,
  });
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
    body: patch,
    query: withSeasonQuery(options.season),
  });
}

export async function getDraftPlayers() {
  return getAllPlayers();
}

export async function selectTeamForPlayer(playerId, team, options = {}) {
  return apiRequest('/draft/select-team', {
    method: 'POST',
    body: { playerId, team },
    query: withSeasonQuery(options.season),
  });
}

export async function resetAllPlayerTeams(options = {}) {
  return apiRequest('/players/reset-teams', {
    method: 'POST',
    query: withSeasonQuery(options.season),
  });
}
