// Match pathname separately from query strings, without allowing prefix collisions.
export const apiRoute = (method, path) => ({
  method,
  hostname: 'localhost',
  pathname: `/api${path}`,
});

export const nhlRoute = (path) => ({
  method: 'GET',
  hostname: 'localhost',
  pathname: `/nhl${path}`,
});
