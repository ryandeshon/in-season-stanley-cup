export function createHttp({ ALLOWED_HOSTS, CORS_ORIGIN, env, https }) {
  function buildCacheControl(ttlSeconds, options = {}) {
    if (!ttlSeconds) return null;
    const scope = options.scope === 'private' ? 'private' : 'public';
    const directives = [
      scope,
      `max-age=${ttlSeconds}`,
      `s-maxage=${options.sharedMaxAge || options.sMaxAge || ttlSeconds}`,
    ];

    if (options.staleWhileRevalidate) {
      directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }
    if (options.staleIfError) {
      directives.push(`stale-if-error=${options.staleIfError}`);
    }

    return directives.join(', ');
  }

  function getCorsOrigin(event) {
    const origin = event?.headers?.origin || event?.headers?.Origin;
    if (!origin) return CORS_ORIGIN === '*' ? '*' : null;
    try {
      const { hostname, protocol } = new URL(origin);
      if (!['http:', 'https:'].includes(protocol)) return null;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '0.0.0.0' ||
        hostname === 'host.docker.internal'
      ) {
        return origin;
      }
      if (ALLOWED_HOSTS.includes(hostname)) return origin;
      if (ALLOWED_HOSTS.some((h) => hostname.endsWith(`.${h}`))) return origin;
    } catch (err) {
      console.error('Invalid origin header', origin, err);
    }
    return CORS_ORIGIN === '*' ? '*' : null;
  }

  function buildHeaders(event, cacheOptions = null) {
    const origin = getCorsOrigin(event);
    const base = {
      'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
    };
    if (origin) base['Access-Control-Allow-Origin'] = origin;
    if (cacheOptions?.ttlSeconds) {
      const cacheControl = buildCacheControl(
        cacheOptions.ttlSeconds,
        cacheOptions
      );
      if (cacheControl) {
        base['Cache-Control'] = cacheControl;
        base['CDN-Cache-Control'] = cacheControl; // Some CDNs (e.g., CloudFront) respect this override.
      }
    }
    return base;
  }

  function response(event, statusCode, body, cacheOptions = null) {
    return {
      statusCode,
      headers: buildHeaders(event, cacheOptions),
      body: JSON.stringify(body ?? {}),
    };
  }

  function normalizePath(event) {
    const raw = event?.rawPath || event?.path || '/';
    const stage = event?.requestContext?.stage;
    let path = raw;
    if (stage && path.startsWith(`/${stage}/`)) {
      path = path.slice(stage.length + 1); // remove "/{stage}"
    } else if (stage && path === `/${stage}`) {
      path = '/';
    }
    return path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  }

  function getMethod(event) {
    return (
      event?.requestContext?.http?.method ||
      event?.httpMethod ||
      'GET'
    ).toUpperCase();
  }

  function parseBody(body) {
    if (!body) return {};
    try {
      return JSON.parse(body);
    } catch (err) {
      console.error('Body parse failed', err);
      return {};
    }
  }

  function getHeaderValue(event, headerName) {
    const headers = event?.headers || {};
    const target = String(headerName || '').toLowerCase();
    const matchedKey = Object.keys(headers).find(
      (key) => String(key).toLowerCase() === target
    );
    if (!matchedKey) return undefined;
    return headers[matchedKey];
  }

  function isAuthorized(event) {
    const requiredAdminToken = env.ADMIN_API_TOKEN;
    if (!requiredAdminToken) return env.SEASON_STORAGE !== 'v2';
    const providedToken = getHeaderValue(event, 'x-admin-token');
    return providedToken === requiredAdminToken;
  }

  function getQueryParams(event) {
    if (
      event?.queryStringParameters &&
      typeof event.queryStringParameters === 'object'
    ) {
      return event.queryStringParameters;
    }
    if (!event?.rawQueryString) return {};
    return Object.fromEntries(new URLSearchParams(event.rawQueryString));
  }
  return {
    buildCacheControl,
    getCorsOrigin,
    buildHeaders,
    response,
    normalizePath,
    getMethod,
    parseBody,
    getHeaderValue,
    isAuthorized,
    getQueryParams,
  };
}
