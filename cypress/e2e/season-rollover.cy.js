import { apiRoute } from '../support/routes';
const catalog = {
  storageVersion: 'v2',
  defaultSeason: 'season3',
  seasons: [
    { id: 'season1', label: 'Season 1', status: 'archived' },
    { id: 'season2', label: 'Season 2', status: 'archived' },
    {
      id: 'season3',
      label: 'Season 3',
      status: 'preseason',
      writersEnabled: true,
    },
  ],
};
describe('Season rollover', () => {
  it('defaults to Season 3 with empty rosters and preserved lifetime totals', () => {
    cy.mockApiScenario('cup-day-multiple-games');
    cy.intercept(apiRoute('GET', '/seasons'), { body: catalog });
    const player = {
      id: '0',
      name: 'Ryan',
      teams: [],
      titleDefenses: 0,
      totalDefenses: 43,
      championships: 1,
    };
    cy.intercept(apiRoute('GET', '/players{,/**}'), (req) =>
      req.reply(
        new URL(req.url).pathname.endsWith('/players') ? [player] : player
      )
    ).as('freshPlayers');
    cy.intercept(apiRoute('GET', '/game-records'), { body: [] });
    cy.visit('/player/Ryan');
    cy.wait('@freshPlayers')
      .its('request.query.season')
      .should('eq', 'season3');
    cy.contains('Title Defenses: 0').should('be.visible');
    cy.contains('Lifetime Defenses: 43').should('be.visible');
    cy.get('[data-test="player-profile-no-games"]').should('be.visible');
    cy.get('img[alt="WPG"]').should('not.exist');
  });
  it('keeps archived draft routes read-only after switching from the fresh draft', () => {
    cy.mockDraftScenario('draft-not-started');
    cy.intercept(apiRoute('GET', '/seasons'), { body: catalog });
    cy.visit('/draft/admin');
    cy.wait('@getDraftState')
      .its('request.query.season')
      .should('eq', 'season3');
    cy.get('[data-test="draft-admin-start"]').should('exist');
    cy.get('[data-test="navigation-menu"]').click();
    cy.get('[data-test="season-select"] input').focus();
    cy.press('2');
    cy.get('[data-test="navigation-menu"]').click();
    cy.get('[data-test="draft-season-read-only"]').should(
      'contain',
      'Season 2'
    );
    cy.get('[data-test="draft-admin-start"]').should('not.exist');
  });
  it('fails closed when the catalog cannot be loaded', () => {
    cy.intercept(apiRoute('GET', '/seasons'), {
      statusCode: 503,
      body: { error: 'unavailable' },
    });
    cy.visit('/draft/admin');
    cy.contains('Season data is unavailable').should('be.visible');
    cy.get('[data-test="draft-admin-start"]').should('not.exist');
  });
});
