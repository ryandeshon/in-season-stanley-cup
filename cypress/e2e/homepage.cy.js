describe('In Season Cup - Homepage', () => {
  context('Cup defense day', () => {
    beforeEach(() => {
      cy.mockApiScenario('cup-day-multiple-games');
    });

    it('defaults the matchup selector to the Cup game and renders champion vs challenger', () => {
      cy.visit('/');
      cy.wait([
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.contains('h1', 'In Season Cup');
      cy.get('[data-test="matchup-select"]').should('have.value', '2024021111');
      cy.get('[data-test="matchup-select"] option').first().contains('Cup Defense');
      cy.contains('Champion');
      cy.contains('Ryan');
      cy.contains('Cooper');
      cy.contains('Period').should('contain', '2');
      cy.contains('Time Remaining').should('contain', '08:12');
      cy.get('[data-test="view-game-details-link"]')
        .should('have.attr', 'href')
        .and('include', '/game/2024021111');
    });

    it('switches to spectator mode when a non-Cup matchup is selected', () => {
      cy.visit('/');
      cy.wait([
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.get('[data-test="matchup-select"]').select('2024021112');
      cy.wait('@getGameInfo');

      cy.get('[data-test="spectator-mode-message"]').should(
        'contain',
        'Spectator mode'
      );
      cy.contains('is not Defending the Championship Today');
      cy.contains('Possible Upcoming Match-ups');
      cy.get('[data-test="view-game-details-link"]').should('not.exist');
    });

    it('navigates to game details and renders lineup data', () => {
      cy.visit('/');
      cy.wait([
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getSchedule',
      ]);
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

  context('Cup day with only one game', () => {
    beforeEach(() => {
      cy.mockApiScenario('cup-day-only');
    });

    it('keeps the Cup game selected and does not enter spectator mode', () => {
      cy.visit('/');
      cy.wait([
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.get('[data-test="matchup-select"]').should('have.value', '2024022201');
      cy.get('[data-test="matchup-select"] option').should('have.length', 1);
      cy.contains('Game Information');
      cy.contains('Cooper');
      cy.contains('Terry');
      cy.get('[data-test="spectator-mode-message"]').should('not.exist');
    });
  });

  context('Spectator/off day', () => {
    beforeEach(() => {
      cy.mockApiScenario('no-games');
    });

    it('shows spectator messaging and upcoming matchups when the champion is idle', () => {
      cy.visit('/');
      cy.wait(['@getChampion', '@getGameId', '@getPlayers', '@getSchedule']);

      cy.contains('Champion');
      cy.contains('is not Defending the Championship Today');
      cy.contains('Possible Upcoming Match-ups');
      cy.get('[data-test="matchup-select"]').should('not.exist');
      cy.contains(/11\\/02/);
      cy.contains(/11\\/03/);
      cy.contains('Terry');
      cy.contains('Ryan');
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
