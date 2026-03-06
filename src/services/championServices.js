// Champion service now uses the API Gateway + Lambda backend instead of direct DynamoDB access.
// NOTE: Ensure CORS (Access-Control-Allow-Origin) headers are enabled on the API Gateway stage so the browser can call it.

// Vue CLI requires VUE_APP_ prefix for environment variables
// src/services/championServices.js (or whatever file)
const API_BASE = process.env.VUE_APP_API_BASE;

function buildUrl(path, options = {}) {
  const url = new URL(`${API_BASE}${path}`);
  if (options?.bustCache) {
    url.searchParams.set('_ts', String(Date.now()));
  }
  return url.toString();
}

function buildFetchOptions(options = {}) {
  if (!options?.bustCache) return {};
  return {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  };
}

export async function getCurrentChampion(options = {}) {
  if (!API_BASE) {
    throw new Error('API_BASE is not configured. Check .env.local file.');
  }

  const response = await fetch(
    buildUrl('/champion', options),
    buildFetchOptions(options)
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch champion: ${response.status}`);
  }

  const data = await response.json();
  // data should look like: { champion: "PHI", gameID: null, message: "..." }
  return data.champion; // return just "PHI"
}

export async function getGameId(options = {}) {
  if (!API_BASE) {
    throw new Error('API_BASE is not configured. Check .env.local file.');
  }

  const response = await fetch(buildUrl('/gameid', options), buildFetchOptions(options));
  if (!response.ok) {
    throw new Error(`Failed to fetch gameID: ${response.status}`);
  }

  const data = await response.json();
  return data.gameID; // return just the ID or null
}
