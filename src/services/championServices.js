import { apiRequest } from '@/services/apiClient';

function buildQuery(options = {}) {
  const query = {};
  if (options.season) {
    query.season = options.season;
  }
  return Object.keys(query).length ? query : undefined;
}

export async function getCurrentChampion(options = {}) {
  const data = await apiRequest('/champion', {
    query: buildQuery(options),
    bustCache: options.bustCache,
    retries: 1,
  });
  return data?.champion || null;
}

export async function getGameId(options = {}) {
  const data = await apiRequest('/gameid', {
    query: buildQuery(options),
    bustCache: options.bustCache,
    retries: 1,
  });
  return data?.gameID ?? null;
}

export async function getSeasonMeta(options = {}) {
  return apiRequest('/season/meta', {
    query: buildQuery(options),
    bustCache: options.bustCache,
    retries: 1,
  });
}

export async function getChampionHistory(options = {}) {
  const query = buildQuery(options) || {};
  if (options.limit !== undefined && options.limit !== null) {
    query.limit = options.limit;
  }

  return apiRequest('/champion/history', {
    query: Object.keys(query).length ? query : undefined,
    bustCache: options.bustCache,
    retries: 1,
  });
}
