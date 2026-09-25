import './commands';

beforeEach(() => {
  // Vuetify menu transitions can defer a resize notification to the next paint.
  // Tolerate a bounded transient only; persistent loops and other errors still fail.
  // https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors
  let deferredResizeNotifications = 0;
  cy.on('uncaught:exception', (error) => {
    if (
      error.message ===
      'ResizeObserver loop completed with undelivered notifications.'
    ) {
      deferredResizeNotifications += 1;
      Cypress.log({
        name: 'resize notification',
        message: String(deferredResizeNotifications),
      });
      if (deferredResizeNotifications <= 3) return false;
    }
  });

  // Register first: scenario stubs registered later take precedence.
  cy.intercept('**', (req) => {
    const url = new URL(req.url);
    const localAsset =
      url.origin === new URL(Cypress.config('baseUrl')).origin &&
      !/^\/(api|nhl)(\/|$)/.test(url.pathname);
    if (
      localAsset &&
      (!['fetch', 'xhr'].includes(req.resourceType) ||
        (req.method === 'GET' &&
          /^\/media\/[a-z0-9.-]+\.mp3$/.test(url.pathname)))
    ) {
      req.continue();
      return;
    }
    throw new Error(`Unstubbed request: ${req.method} ${req.url}`);
  });

  cy.intercept(
    { method: 'GET', hostname: 'localhost', pathname: '/api/seasons' },
    {
      body: {
        defaultSeason: 'season2',
        seasons: [
          { id: 'season1', label: 'Season 1', status: 'archived' },
          { id: 'season2', label: 'Season 2', status: 'active' },
        ],
      },
    }
  );

  // Electron's browser process can fetch a dictionary even with webContents
  // spellcheck disabled. Stub only this browser-owned download, never app APIs.
  cy.intercept(
    {
      method: 'GET',
      hostname: /(^|\.)gvt1\.com$/,
      pathname: /^\/edgedl\/chrome\/dict\/[a-zA-Z0-9_-]+\.bdic$/,
    },
    { statusCode: 204, body: '' }
  );

  // NHL logo assets are decorative; keep the suite independent of that CDN.
  cy.intercept('GET', 'https://assets.nhle.com/logos/**', {
    statusCode: 200,
    headers: { 'content-type': 'image/svg+xml' },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>',
  });
  cy.intercept('GET', 'https://fonts.googleapis.com/**', {
    headers: { 'content-type': 'text/css' },
    body: '',
  });
  cy.intercept('GET', 'https://fonts.cdnfonts.com/**', {
    headers: { 'content-type': 'text/css' },
    body: '',
  });
  cy.intercept('GET', 'https://www.googletagmanager.com/**', {
    headers: { 'content-type': 'application/javascript' },
    body: '',
  });
});
