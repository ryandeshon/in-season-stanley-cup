const DEFAULT_TIMEOUT_MS = Number(process.env.VUE_APP_API_TIMEOUT_MS) || 10000;
const DEFAULT_RETRY_DELAY_MS = 300;

export class ApiClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status ?? 0;
    this.method = options.method || 'GET';
    this.url = options.url || '';
    this.details = options.details ?? null;
    this.cause = options.cause;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(path, { baseURL, query, bustCache }) {
  const normalizedBase = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  const url = new URL(normalizedPath, normalizedBase);

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }

  if (bustCache) {
    url.searchParams.set('_ts', String(Date.now()));
  }

  return url;
}

async function parseResponseBody(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function shouldRetry(error, attempt, retries) {
  if (attempt >= retries) return false;
  if (!(error instanceof ApiClientError)) return true;
  return error.status === 0 || error.status >= 500;
}

export async function apiRequest(path, options = {}) {
  const baseURL = options.baseURL || process.env.VUE_APP_API_BASE;
  if (!baseURL) {
    throw new ApiClientError('VUE_APP_API_BASE is not configured.');
  }

  const method = (options.method || 'GET').toUpperCase();
  const retries = Number(options.retries || 0);
  const retryDelayMs = Number(options.retryDelayMs || DEFAULT_RETRY_DELAY_MS);
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const url = buildUrl(path, {
      baseURL,
      query: options.query,
      bustCache: options.bustCache,
    });

    try {
      const headers = {
        Accept: 'application/json',
        ...options.headers,
      };

      if (options.body !== undefined && options.body !== null) {
        headers['Content-Type'] = 'application/json';
      }

      if (options.bustCache) {
        headers['Cache-Control'] = 'no-cache';
        headers.Pragma = 'no-cache';
      }

      const response = await fetch(url.toString(), {
        method,
        headers,
        body:
          options.body !== undefined && options.body !== null
            ? JSON.stringify(options.body)
            : undefined,
        cache: options.cache || (options.bustCache ? 'no-store' : 'default'),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const payload = await parseResponseBody(response);

      if (!response.ok) {
        throw new ApiClientError(
          `Request failed with status ${response.status}`,
          {
            status: response.status,
            method,
            url: url.toString(),
            details: payload,
          }
        );
      }

      return payload;
    } catch (error) {
      clearTimeout(timeout);
      lastError =
        error instanceof ApiClientError
          ? error
          : new ApiClientError(
              error?.name === 'AbortError'
                ? `Request timed out after ${timeoutMs}ms`
                : 'Network request failed',
              {
                status: 0,
                method,
                url: url.toString(),
                cause: error,
              }
            );

      if (!shouldRetry(lastError, attempt, retries)) {
        throw lastError;
      }

      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError || new ApiClientError('Request failed');
}
