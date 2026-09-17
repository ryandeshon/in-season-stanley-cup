import { apiRoute, nhlRoute } from '../support/routes';

describe('In Season Cup - Homepage', () => {
  context('Cup defense day', () => {
    beforeEach(() => {
      cy.mockApiScenario('cup-day-multiple-games');
    });

    it('renders champion vs challenger with no conditional matchup list selected by default', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
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
      cy.get('[data-test="champion-goal-scorers"]').should(
        'contain',
        'Brad Marchand (2)'
      );
      cy.get('[data-test="challenger-goal-scorers"]').should(
        'contain',
        'Mitch Marner'
      );
      cy.get('[data-test="conditional-matchups-section"]').should('not.exist');
      cy.get('[data-test="whats-next-panel"]').should('not.exist');
      cy.get('[data-test="view-game-details-link"]')
        .should('have.attr', 'href')
        .and('include', '/game/2024021111');
      cy.get('[data-test="champion-history-list"]').should('exist');
      cy.get('[data-test="champion-history-item"]').should(
        'have.length.at.least',
        1
      );
    });

    it('shows conditional rest-of-week matchups when champion or challenger is selected', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
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
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
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

  context('Cup day with no next-day defense options', () => {
    beforeEach(() => {
      cy.mockApiScenario('cup-day-only');
    });

    it('shows an empty-state message for selected winner outcomes', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.get('[data-test="champion-goal-scorers"]').should('not.exist');
      cy.get('[data-test="challenger-goal-scorers"]').should('not.exist');

      cy.get('[data-test="champion-select-card"] .v-card').click();
      cy.get('[data-test="conditional-matchups-empty"]').should(
        'contain',
        'No possible matchups for this winner this week.'
      );
    });
  });

  context('Game final state', () => {
    beforeEach(() => {
      cy.mockApiScenario('cup-day-final');
    });

    it('shows the unified next-defense panel and removes the legacy next-game snippet', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
        '@getChampion',
        '@getGameId',
        '@getGameInfo',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.contains('Game Over');
      cy.get('[data-test="winner-goal-scorers"]').should('not.exist');
      cy.get('[data-test="loser-goal-scorers"]').should('not.exist');
      cy.get('.next-game-info').should('not.exist');
      cy.get('[data-test="whats-next-panel"]').should('exist');
      cy.get('[data-test="whats-next-row"]').should('have.length', 2);
      cy.contains('Boz');
      cy.contains('Ryan');
    });
  });

  context('Off day', () => {
    beforeEach(() => {
      cy.mockApiScenario('no-games');
    });

    it('shows timeline + next-defense data when the champion is idle', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
        '@getChampion',
        '@getGameId',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.contains('Champion');
      cy.contains('is not Defending the Championship Today');
      cy.contains("What's Next");
      cy.contains('Possible Upcoming Match-ups');
      cy.get('[data-test="conditional-matchups-section"]').should('not.exist');
      cy.get('[data-test="whats-next-row"]').should('have.length', 2);
      cy.contains('11/02');
      cy.contains('11/03');
      cy.contains('Terry');
      cy.contains('Boz');
      cy.get('[data-test="champion-history-item"]').should('have.length', 2);
      cy.contains('[data-test="champion-history-item"]', 'VAN def. PHI');
    });
  });

  context('Timeline load-more', () => {
    beforeEach(() => {
      cy.mockApiScenario('no-games-history-long');
    });

    it('shows 6 timeline rows by default and reveals more on demand', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
        '@getChampion',
        '@getGameId',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.get('[data-test="champion-history-streak"]').should(
        'contain',
        'Current Streak'
      );
      cy.get('[data-test="champion-history-item"]').should('have.length', 6);
      cy.get('[data-test="champion-history-load-more"]').click();
      cy.get('[data-test="champion-history-item"]').should('have.length', 8);
      cy.get('[data-test="champion-history-load-more"]').should('not.exist');
    });
  });

  context("What's Next empty state", () => {
    beforeEach(() => {
      cy.mockApiScenario('no-games-empty-next');
    });

    it('shows empty next-defense state and timeline empty state', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
        '@getChampion',
        '@getGameId',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.get('[data-test="whats-next-empty"]').should(
        'contain',
        'No next-defense games are scheduled this week.'
      );
      cy.get('[data-test="champion-history-empty"]').should(
        'contain',
        'No champion transitions recorded yet.'
      );
    });
  });

  context("What's Next error state", () => {
    beforeEach(() => {
      cy.mockApiScenario('no-games-next-error');
    });

    it('shows error state when next-defense schedule cannot load', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
        '@getChampion',
        '@getGameId',
        '@getPlayers',
        '@getSchedule',
      ]);

      cy.get('[data-test="whats-next-error"]').should(
        'contain',
        'Unable to load next-defense outlook right now.'
      );
      cy.get('[data-test="champion-history-item"]').should('have.length', 1);
    });
  });

  context('Season-over metadata', () => {
    beforeEach(() => {
      cy.mockApiScenario('season-over');
    });

    it('shows the season-over homepage branch with flashy champion experience', () => {
      cy.visit('/');
      cy.wait(['@getSeasonMeta', '@getChampion', '@getPlayers']);
      cy.contains('h1', 'In Season Cup Champion');
      cy.contains("What's Next").should('not.exist');
      cy.get('[data-test="champion-timeline"]').should('not.exist');
      cy.get('[data-test="season-champion-flash"]').should('exist');
      cy.get('[data-test="season-champion-flash-image"]').should('exist');
      cy.get('[data-test="season-champion-flash-quote"]').should(
        'contain',
        'Suck It Nerds'
      );
    });
  });

  context('Upstream errors', () => {
    beforeEach(() => {
      cy.mockApiScenario('api-error');
    });

    it('surfaces a stable page even when upstream APIs fail', () => {
      cy.visit('/');
      cy.wait([
        '@getSeasonMeta',
        '@getChampionHistory',
        '@getChampion',
        '@getGameId',
      ]);

      cy.contains('h1', 'In Season Cup');
      cy.get('[data-test="home-warning"]').should(
        'contain',
        'Unable to refresh champion/game status right now.'
      );
      cy.get('.v-progress-circular').should('not.exist');
    });
  });
});

describe('Home recovery and pregame', () => {
  it('shows scheduled game information before puck drop', () => {
    cy.mockApiScenario('cup-day-multiple-games');
    cy.fixture('cup-day-multiple-games').then((data) => {
      cy.intercept(nhlRoute('/gamecenter/**/boxscore'), {
        ...data.gameInfoResponse,
        gameState: 'FUT',
      }).as('pregame');
    });
    cy.visit('/');
    cy.wait('@pregame');
    cy.contains('Game Information').should('be.visible');
    cy.contains('Time Remaining').should('not.exist');
    cy.get('[data-test="view-game-details-link"]').should('exist');
  });
  it('clears a status error on visibility refresh after service recovery', () => {
    cy.mockApiScenario('cup-day-multiple-games');
    let unavailable = true;
    cy.intercept(apiRoute('GET', '/champion'), (req) => {
      req.reply(
        unavailable
          ? { statusCode: 503, body: { error: 'Unavailable' } }
          : { body: { champion: 'BOS' } }
      );
    }).as('recoverChampion');
    cy.visit('/');
    cy.get('[data-test="home-warning"]').should('contain', 'Unable to refresh');
    cy.then(() => {
      unavailable = false;
    });
    cy.document().then((doc) => {
      Object.defineProperty(doc, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    cy.get('[data-test="home-warning"]').should('not.exist');
    cy.get('[data-test="champion-select-card"]').should('contain', 'Ryan');
  });
});
