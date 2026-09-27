import { apiRoute } from '../support/routes';
describe('In Season Cup - Standings', () => {
  beforeEach(() => {
    cy.mockApiScenario('no-games-history-long');
  });

  it('shows the verified season date range before any games are recorded', () => {
    cy.intercept(apiRoute('GET', '/seasons'), {
      body: {
        storageVersion: 'v2',
        defaultSeason: 'season3',
        seasons: [
          {
            id: 'season3',
            label: 'Season 3',
            status: 'active',
            writersEnabled: true,
            regularSeasonStart: '2026-09-29',
            regularSeasonEnd: '2027-04-10',
          },
        ],
      },
    });
    cy.intercept(apiRoute('GET', '/game-records'), { body: [] });
    cy.visit('/standings');
    cy.get('[data-test="season-progress"]').should('contain', '0%');
    cy.contains('9/29 to 4/10');
    cy.contains('0 games tracked');
  });

  it('renders champion timeline with streak and load-more behavior', () => {
    cy.visit('/standings');
    cy.wait([
      '@getPlayers',
      '@getGameRecords',
      '@getChampion',
      '@getChampionHistory',
    ]);

    cy.contains('h1', 'Standings');
    cy.get('[data-test="standings-champion-timeline"]').should('exist');
    cy.get('[data-test="standings-champion-history-streak"]').should(
      'contain',
      'Current Streak'
    );
    cy.get('[data-test="standings-champion-history-item"]').should(
      'have.length',
      6
    );
    cy.get('[data-test="standings-champion-history-load-more"]').click();
    cy.get('[data-test="standings-champion-history-item"]').should(
      'have.length',
      8
    );
  });
});
