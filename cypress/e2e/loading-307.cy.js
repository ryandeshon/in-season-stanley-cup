import { apiRoute } from '../support/routes';

describe('3.0.7 game-first loading', () => {
  it('fetches matchup while metadata is pending and shows the game without waiting for history', () => {
    cy.viewport(390, 844);
    cy.mockApiScenario('cup-day-multiple-games');
    cy.intercept(apiRoute('GET', '/seasons'), {
      body: {
        defaultSeason: 'season3',
        seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
      },
    });
    let metadataFinished = false;
    let historyFinished = false;
    cy.intercept(apiRoute('GET', '/season/meta'), (req) => {
      req.on('after:response', () => {
        metadataFinished = true;
      });
      req.reply({ delay: 1500, body: { seasonOver: false } });
    });
    cy.intercept(apiRoute('GET', '/champion'), (req) => {
      expect(
        metadataFinished,
        'champion request starts before metadata finishes'
      ).to.eq(false);
      req.reply({ body: { champion: 'BOS' } });
    });
    cy.intercept(apiRoute('GET', '/champion/history'), (req) => {
      req.on('after:response', () => {
        historyFinished = true;
      });
      req.reply({ delay: 5000, body: { history: [] } });
    }).as('slowHistory');
    cy.intercept(apiRoute('GET', '/game-records'), { delay: 500, body: [] }).as(
      'sharedRecords'
    );
    cy.visit('/');
    cy.get('[data-test="arcade-arena"]')
      .should('be.visible')
      .then(() => {
        expect(historyFinished, 'game visible before history returns').to.eq(
          false
        );
      });
    cy.get('@sharedRecords.all').should('have.length', 1);
    cy.wait('@slowHistory');
    cy.get('[data-test="arcade-arena"]').should('be.visible');
  });
});
