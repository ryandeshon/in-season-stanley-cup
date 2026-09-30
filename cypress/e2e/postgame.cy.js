import { apiRoute, nhlRoute } from '../support/routes';
function setup(overrides) {
  cy.mockApiScenario('cup-day-multiple-games');
  cy.intercept(apiRoute('GET', '/seasons'), {
    body: {
      defaultSeason: 'season3',
      seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
    },
  });
  cy.fixture('cup-day-multiple-games').then((data) => overrides(data));
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem('selectedSeason', 'season3');
    },
  });
}
describe('3.0.3 game presentation', () => {
  it('restores the final matchup after backend cleanup and a reload', () => {
    setup((data) => {
      cy.intercept(apiRoute('GET', '/gameid'), { body: { gameID: null } });
      cy.intercept(apiRoute('GET', '/game-records'), {
        body: [
          {
            id: data.gameInfoResponse.id,
            wTeam: 'BOS',
            lTeam: 'TOR',
            wScore: 2,
            lScore: 1,
            savedAt: data.gameInfoResponse.startTimeUTC,
          },
        ],
      });
      cy.intercept(nhlRoute('/gamecenter/**/boxscore'), {
        body: { ...data.gameInfoResponse, gameState: 'FINAL' },
      });
    });
    cy.get('.arcade-arena').should('be.visible');
    cy.get('.hud-score').should('contain', 'FINAL SCORE');
    cy.get('.fighter').should('have.length', 2);
    cy.reload();
    cy.get('.hud-score').should('contain', 'FINAL SCORE');
    cy.get('.fighter').should('have.length', 2);
    cy.screenshot('303-retained-final', { capture: 'viewport' });
  });
  it('replaces the period label with INT and the countdown', () => {
    setup((data) => {
      cy.intercept(nhlRoute('/gamecenter/**/boxscore'), {
        body: {
          ...data.gameInfoResponse,
          clock: { inIntermission: true, secondsRemaining: 1040 },
          periodDescriptor: { number: 2, periodType: 'REG' },
        },
      });
    });
    cy.get('.hud-score')
      .should('contain', 'INT · 17:20')
      .and('not.contain', 'PERIOD');
    cy.screenshot('303-intermission', { capture: 'viewport' });
  });
});
