describe('In Season Cup - Homepage', () => {
  context('Cup defense day', () => {
    beforeEach(() => {
      cy.mockApiScenario('cup-day-multiple-games');
    });

    it('renders champion vs challenger with no conditional matchup list selected by default', () => {
      cy.visit('/');
      cy.wait([
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.contains('h1', 'In Season Cup');
      cy.contains('Champion');
      cy.contains('Ryan');
      cy.contains('Cooper');
      cy.contains('Period').should('contain', '2');
      cy.contains('Time Remaining').should('contain', '08:12');
      cy.get('[data-test="conditional-matchups-section"]').should('not.exist');
      cy.get('[data-test="view-game-details-link"]')
        .should('have.attr', 'href')
        .and('include', '/game/2024021111');
    });

    it('shows conditional rest-of-week matchups when champion or challenger is selected', () => {
      cy.visit('/');
      cy.wait([
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.get('[data-test="champion-select-card"] .v-card').click();
      cy.contains('Possible Upcoming Match-ups If Ryan Wins Tonight');
      cy.get('[data-test="conditional-matchup-row"]').should('have.length', 2);
      cy.contains('Terry');
      cy.contains('Boz');

      cy.get('[data-test="challenger-select-card"] .v-card').click();
      cy.contains('Possible Upcoming Match-ups If Cooper Wins Tonight');
      cy.get('[data-test="conditional-matchup-row"]').should('have.length', 2);
      cy.contains('Boz');
      cy.contains('Terry');

      cy.get('[data-test="view-game-details-link"]')
        .parent()
        .next('[data-test="conditional-matchups-section"]')
        .should('exist');
    });

    it('navigates to game details and renders lineup data', () => {
      cy.visit('/');
      cy.wait(['@getChampion', '@getGameId', '@getGameInfo', '@getSchedule']);
      cy.get('[data-test="view-game-details-link"]').click();

      cy.url().should('include', '/game/2024021111');
      cy.wait('@getGameInfo');
      cy.contains('Game Details');
      cy.contains('Toronto Maple Leafs');
      cy.contains('Boston Bruins');
      cy.contains('Away Team Players');
      cy.contains('Mitch Marner');
      cy.contains('Goalies');
    });
  });

  context('Cup day with no next-day defense options', () => {
    beforeEach(() => {
      cy.mockApiScenario('cup-day-only');
    });

    it('shows an empty-state message for selected winner outcomes', () => {
      cy.visit('/');
      cy.wait([
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.get('[data-test="champion-select-card"] .v-card').click();
      cy.get('[data-test="conditional-matchups-empty"]').should(
        'contain',
        'No possible matchups for this winner this week.'
      );
    });
  });

  context('Off day', () => {
    beforeEach(() => {
      cy.mockApiScenario('no-games');
    });

    it('shows upcoming matchups when the champion is idle', () => {
      cy.visit('/');
      cy.wait(['@getChampion', '@getGameId', '@getPlayers', '@getSchedule']);

      cy.contains('Champion');
      cy.contains('is not Defending the Championship Today');
      cy.contains('Possible Upcoming Match-ups');
      cy.get('[data-test="conditional-matchups-section"]').should('not.exist');
      cy.contains('11/02');
      cy.contains('11/03');
      cy.contains('Terry');
      cy.contains('Boz');
    });
  });

  context('Upstream errors', () => {
    beforeEach(() => {
      cy.mockApiScenario('api-error');
    });

    it('surfaces a stable page even when upstream APIs fail', () => {
      cy.visit('/');
      cy.wait(['@getChampion', '@getGameId']);

      cy.contains('h1', 'In Season Cup');
      cy.contains('Champion');
      cy.contains('Possible Upcoming Match-ups');
      cy.get('.v-progress-circular').should('not.exist');
    });
  });
});
