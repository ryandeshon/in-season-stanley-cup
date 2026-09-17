import './commands';

beforeEach(() => {
  // Register first: scenario stubs registered later take precedence.
  cy.intercept('**', (req) => {
    const url = new URL(req.url);
    const localAsset =
      url.origin === 'http://localhost:8080' &&
      !/^\/(api|nhl)(\/|$)/.test(url.pathname);
    if (localAsset && !['fetch', 'xhr'].includes(req.resourceType)) {
      req.continue();
      return;
    }
    throw new Error(`Unstubbed request: ${req.method} ${req.url}`);
  });

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
