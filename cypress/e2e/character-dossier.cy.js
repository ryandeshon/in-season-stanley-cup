import { apiRoute } from '../support/routes';

describe('Arcade character dossiers', () => {
  for (const width of [1280, 390]) {
    it(`combines the profile and cycles expressions with mouse and keyboard at ${width}px`, () => {
      cy.viewport(width, 1000);
      cy.mockApiScenario('player-profile-head-to-head');
      cy.intercept(apiRoute('GET', '/seasons'), { body: {
        defaultSeason: 'season3', seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
      } });
      cy.visit('/player/Ryan', { onBeforeLoad(win) { win.localStorage.setItem('selectedSeason', 'season3'); } });
      cy.get('[data-test="character-dossier"]').should('have.length', 1);
      cy.get('.dossier-card').should('contain', 'The Tournament Keeper').and('contain', 'Title Defenses:');
      cy.get('.dossier-portrait .portrait-visual').should('have.attr', 'data-art', 'expressions');
      cy.get('.dossier-card').click();
      cy.get('.portrait-visual').should('have.attr', 'data-emotion', 'Angry');
      cy.get('.dossier-card').focus().type('{enter}');
      cy.get('.portrait-visual').should('have.attr', 'data-emotion', 'Anguish');
      cy.get('.dossier-card').type(' ');
      cy.get('.portrait-visual').should('have.attr', 'data-emotion', 'Sad');
      cy.get('.dossier-card').click();
      cy.get('.portrait-visual').should('have.attr', 'data-emotion', 'Happy');
      cy.get('[data-test="championship-honors"] img').should('have.attr', 'src').and('contain', 'championship-cup');
      cy.get('.brand-mark').should('have.attr', 'src').and('contain', 'championship-cup');
      cy.get('link[rel=icon]').should('have.attr', 'href').and('contain', 'arcade-favicon.svg');
      cy.get('.dossier-card').should(([card]) => {
        expect(card.getBoundingClientRect().right).to.be.at.most(width);
      });
      cy.get('[data-test="player-profile-head-to-head-row-cooper"] a').click();
      cy.get('.dossier-card').should('contain', 'Cooper').and('contain', 'Season 1 champion');
      cy.get('.portrait-visual').should('have.attr', 'data-emotion', 'Happy');
      cy.document().then(doc => doc.fonts.ready);
      cy.get('.v-app-bar').invoke('css', 'position', 'absolute');
      cy.get('.character-dossier').scrollIntoView().screenshot(`dossier-cooper-${width}`);
    });
  }
});
