describe('In Season Cup - Homepage', () => {
  context('Cup defense day', () => {
    beforeEach(() => {
      cy.mockApiScenario('cup-day-multiple-games');
    });

    it('shows the Cup matchup with champion vs challenger as the default view', () => {
      cy.visit('/');
      cy.wait(['@getChampion', '@getGameId', '@getGameInfo', '@getPlayers']);

      cy.contains('h1', 'In Season Cup');
      cy.contains('Champion');
      cy.contains('Ryan');
      cy.contains('Cooper');
      cy.contains('Period').should('contain', '2');
      cy.contains('Time Remaining').should('contain', '08:12');
      cy.contains('View Game Details')
        .should('have.attr', 'href')
        .and('include', '/game/2024021111');
    });

    it('navigates to game details and renders lineup data', () => {
      cy.visit('/');
      cy.wait(['@getChampion', '@getGameId', '@getGameInfo']);
      cy.contains('View Game Details').click();

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
