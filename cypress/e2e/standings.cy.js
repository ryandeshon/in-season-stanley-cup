describe.skip('In Season Cup - Standings', () => {
  beforeEach(() => {
    cy.mockApiScenario('no-games-history-long');
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
