import { ApiClientError, apiRequest } from '@/services/apiClient';

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
    retries: 0,
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
    retries: 0,
  });
}

export function isLocalDevelopmentRuntime() {
  if (typeof window !== 'undefined') {
    const host = window.location?.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  }
  return process.env.NODE_ENV !== 'production';
}

function parseBooleanEnv(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

export function areSeasonContractEndpointsEnabled() {
  const explicit = parseBooleanEnv(process.env.VUE_APP_ENABLE_SEASON_CONTRACTS);
  if (explicit !== null) {
    return explicit;
  }
  return true;
}

export function isContractEndpointUnavailableError(error) {
  if (!(error instanceof ApiClientError)) return false;
  if (error.status === 0 || error.status === 404) return true;
  const detailMessage = String(
    error.details?.message || error.details?.error || ''
  ).toLowerCase();
  return (
    error.status === 403 && detailMessage.includes('missingauthenticationtoken')
  );
}

export function shouldUseContractFallback(error) {
  return (
    isLocalDevelopmentRuntime() && isContractEndpointUnavailableError(error)
  );
}
