import { apiRoute } from '../support/routes';

function setupArchive(season, { empty = false, failed = false } = {}) {
  cy.mockApiScenario('season-over');
  cy.intercept(apiRoute('GET', '/seasons'), {
    body: {
      storageVersion: 'v2',
      defaultSeason: season,
      seasons: [
        {
          id: season,
          label: season === 'season1' ? 'Season 1' : 'Season 2',
          status: 'archived',
          writersEnabled: false,
        },
      ],
    },
  });
  cy.intercept(apiRoute('GET', '/players{,/**}'), {
    body: [
      { id: '1', name: 'Cooper', teams: ['BOS'], titleDefenses: 8 },
      { id: '0', name: 'Ryan', teams: ['ANA'], titleDefenses: 24 },
    ],
  });
  // Unsorted data proves we choose the last recorded cup game, not the first row.
  cy.intercept(apiRoute('GET', '/game-records'), {
    statusCode: failed ? 503 : 200,
    body: failed
      ? { error: 'Unavailable' }
      : empty
        ? []
        : [
            {
              id: 2024020001,
              wTeam: 'ANA',
              lTeam: 'BOS',
              wScore: 2,
              lScore: 1,
            },
            {
              id: 2024021312,
              wTeam: 'BOS',
              lTeam: 'ANA',
              wScore: 4,
              lScore: 0,
            },
          ],
  }).as('archiveRecords');
  cy.visit('/');
}

describe('Archived home matchups', () => {
  for (const season of ['season1', 'season2']) {
    it(`opens ${season} on its last matchup with an optional winner screen`, () => {
      const width = season === 'season1' ? 320 : 390;
      cy.viewport(width, 844);
      setupArchive(season);
      cy.wait('@archiveRecords')
        .its('request.query.season')
        .should('eq', season);
      cy.get('[data-test="archived-matchup"]').should(
        'contain',
        'Final cup matchup'
      );
      cy.get('[data-test="archive-winner"]')
        .should('contain', 'Cooper')
        .and('contain', '4');
      cy.get('[data-test="archive-loser"]')
        .should('contain', 'Ryan')
        .and('contain', '0');
      cy.get('[data-test="archive-game-details"]').should(
        'have.attr',
        'href',
        '/game/2024021312'
      );
      cy.get(`[class*="v-theme--${season}-"]`).should('exist');
      cy.get('[data-test="season-champion-flash"]').should('not.exist');
      cy.get('[data-test="arcade-arena"]').should('not.exist');
      cy.get('[data-test="whats-next-panel"]').should('not.exist');
      cy.document()
        .its('documentElement.scrollWidth')
        .should('be.at.most', width);
      cy.get('[data-test="season-winner-toggle"]').click();
      cy.get('[data-test="season-champion-flash"]')
        .should('be.visible')
        .and('contain', 'Suck It Nerds');
      cy.get('[data-test="archived-matchup"]').should('not.exist');
      cy.get('[data-test="season-winner-toggle"]')
        .should('contain', 'Back to matchup')
        .click();
      cy.get('[data-test="archived-matchup"]').should('be.visible');
      cy.get('[data-test="season-winner-toggle"]').click();
      cy.reload();
      cy.get('[data-test="archived-matchup"]').should('be.visible');
      cy.get('[data-test="season-champion-flash"]').should('not.exist');
    });
  }
  it('handles an archive without games without inventing a matchup', () => {
    setupArchive('season1', { empty: true });
    cy.get('[data-test="archive-no-games"]').should('be.visible');
    cy.get('[data-test="archive-game-details"]').should('not.exist');
    cy.get('[data-test="season-winner-toggle"]').should('be.visible');
  });
  it('reports a failed archive request without showing a false empty season', () => {
    setupArchive('season2', { failed: true });
    cy.contains('The archived matchup could not be loaded.').should(
      'be.visible'
    );
    cy.get('[data-test="archive-no-games"]').should('not.exist');
  });
});
