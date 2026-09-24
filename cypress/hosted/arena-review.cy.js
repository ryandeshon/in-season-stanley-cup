describe('Champion realms', () => {
  it('loads each champion background and updates the winner heading', () => {
    cy.intercept('GET', 'https://assets.nhle.com/logos/**', {
      headers: { 'content-type': 'image/svg+xml' },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>',
    });
    cy.viewport(1280, 1400);
    cy.visit('/');
    cy.contains('DESIGN PREVIEW · SAMPLE DATA').should('be.visible');
    for (const [owner, name] of [
      ['Ryan', 'The Black Rink'], ['Cooper', 'Thunderkeep Ice'],
      ['Boz', 'The Spotlight Pit'], ['Terry', 'The Venom Vault'],
    ]) {
      cy.window().then(async (win) => {
        for (const command of [
          { action: 'reset' },
          { action: 'owners', left: owner, right: owner === 'Ryan' ? 'Cooper' : 'Ryan' },
          { action: 'shutout' },
        ]) {
          const response = await win.fetch('/__arcade-preview/preview', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command),
          });
          expect(response.ok).to.equal(true);
        }
      });
      cy.reload();
      cy.get('.arena-topline .eyebrow').should('have.text', name);
      cy.get('.victory-heading h2').should('have.text', owner);
      cy.get('.portrait-visual').should('have.attr', 'data-art', 'expressions');
      cy.get('.fighter.defeated .portrait-visual').should('have.css', 'filter', 'brightness(0.62)');
      cy.get('.arcade-arena').then(([arena]) => {
        const url = getComputedStyle(arena).getPropertyValue('--arena-background').trim().slice(4, -1).replaceAll('"', '');
        return new Cypress.Promise((resolve, reject) => {
          const image = new Image();
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
      });
      cy.document().then(doc => doc.fonts.ready);
      cy.get('.fighters img:not(.atlas-loader)').should(($images) => {
        [...$images].forEach(image => expect(image.naturalWidth).to.be.greaterThan(0));
      });
      cy.get('.v-app-bar').invoke('css', 'position', 'absolute');
      cy.get('.arcade-arena').scrollIntoView().screenshot(`realm-${owner.toLowerCase()}`);
    }
    cy.viewport(390, 844);
    cy.get('.arcade-arena').scrollIntoView().screenshot('realm-terry-mobile');
  });
});
