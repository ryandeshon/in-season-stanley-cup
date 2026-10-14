import { apiRoute } from '../support/routes';
describe('3.0.6 startup shell', () => {
  it('shows the rink loading screen while the catalog is delayed, then mounts the game', () => {
    cy.viewport(390, 844);
    cy.mockApiScenario('cup-day-multiple-games');
    cy.intercept(apiRoute('GET', '/seasons'), {
      delay: 2500,
      body: {
        defaultSeason: 'season3',
        seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
      },
    }).as('catalog');
    cy.visit('/');
    cy.get('#startup-shell')
      .should('be.visible')
      .and('contain', 'Loading the rink');
    cy.get('body').should('have.css', 'background-color', 'rgb(20, 26, 20)');
    cy.wait('@catalog');
    cy.get('[data-test="arcade-arena"]').should('be.visible');
    cy.get('#startup-shell').should('not.exist');
  });
  it('keeps a visible error when the catalog cannot load', () => {
    cy.mockApiScenario('cup-day-multiple-games');
    cy.intercept(apiRoute('GET', '/seasons'), { statusCode: 503, body: {} });
    cy.visit('/');
    cy.contains('Season data is unavailable').should('be.visible');
    cy.get('#startup-shell').should('not.exist');
  });
});
