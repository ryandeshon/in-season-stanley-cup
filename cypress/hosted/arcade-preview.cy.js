describe('Hosted arcade preview isolation', () => {
  it('runs the production build with browser fixtures, reloads owner choices and rejects real writes', () => {
    cy.intercept('https://fonts.cdnfonts.com/**', {
      headers: { 'content-type': 'text/css' },
      body: '',
    });
    cy.intercept('https://fonts.googleapis.com/**', {
      headers: { 'content-type': 'text/css' },
      body: '',
    });
    cy.intercept({ url: /^https?:/ }, (req) => {
      const url = new URL(req.url);
      const origin = new URL(Cypress.config('baseUrl')).origin;
      if (
        url.origin !== origin &&
        !['fonts.cdnfonts.com', 'fonts.googleapis.com'].includes(url.hostname)
      ) {
        throw Error(`Unexpected external request: ${url.hostname}`);
      }
    });
    cy.intercept(
      {
        method: 'GET',
        hostname: /(^|\.)gvt1\.com$/,
        pathname: /^\/edgedl\/chrome\/dict\/[a-zA-Z0-9_-]+\.bdic$/,
      },
      { statusCode: 204, body: '' }
    );
    cy.intercept('GET', 'https://assets.nhle.com/logos/**', {
      headers: { 'content-type': 'image/svg+xml' },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>',
    });
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('selectedSeason', 'season2');
      },
    });
    cy.contains('DESIGN PREVIEW · SAMPLE DATA').should('be.visible');
    cy.contains('button', 'Reset').click();
    cy.get('[data-test="arcade-arena"]').should('be.visible');
    cy.get('.hud-score strong').should('contain', '2').and('contain', '1');
    cy.contains('button', 'BOS goal').click();
    cy.get('.hud-score strong').should('contain', '3');
    cy.get('.preview-controls select').first().select('Boz');
    cy.get('.fighter.left').should('contain', 'Boz');
    cy.get('.preview-controls select').first().should('have.value', 'Boz');
    cy.get('.preview-controls select').last().select('Terry');
    cy.get('.fighter.left').should('contain', 'Boz');
    cy.get('.fighter.right').should('contain', 'Terry');
    cy.contains('button', 'Shutout final').click();
    cy.get('[data-test="flawless-victory"]').should('be.visible');
    cy.get('.victory-heading').should('contain', 'Boz');
    cy.get('[data-test="navigation-menu"]').click();
    cy.get('[data-test="navigation-menu"]').should(
      'have.attr',
      'aria-expanded',
      'true'
    );
    cy.contains('.v-overlay--active .v-list-item', 'The Black Rink story')
      .should('be.visible')
      .click();
    cy.get('.story-console').should('be.visible');
    cy.location('pathname').should('eq', '/story');
    cy.reload();
    cy.get('.story-console').should('be.visible');
    cy.location('pathname').should('eq', '/story');
    cy.window().then(async (win) => {
      const unknown = await win.fetch('/__arcade-preview/api/not-a-fixture');
      expect(unknown.status).to.eq(404);
      const write = await win.fetch('/__arcade-preview/api/draft/pick', {
        method: 'POST',
        body: '{}',
      });
      expect(write.status).to.eq(405);
    });
    cy.contains('button', 'Reset').click();
    cy.contains('a', 'Skip to the arena').click();
    cy.get('.fighter.left').should('contain', 'Ryan');
    cy.get('.hud-score strong').should('contain', '2');
  });
});
