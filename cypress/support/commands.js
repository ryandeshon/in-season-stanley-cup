// Helpers for consistent API stubbing across scenarios
Cypress.Commands.add('mockApiScenario', (fixtureName = 'cup-day-multiple-games') => {
  cy.fixture(fixtureName).then((data) => {
    const {
      championResponse,
      championStatus = 200,
      gameIdResponse,
      gameIdStatus = 200,
      playersResponse = [],
      gameRecordsResponse = [],
      gameInfoResponse = {},
      gameInfoStatus = 200,
      scheduleResponse = { gameWeek: [] },
    } = data;

    cy.intercept('GET', '**/champion', {
      statusCode: championStatus,
      body: championResponse,
    }).as('getChampion');

    cy.intercept('GET', '**/gameid', {
      statusCode: gameIdStatus,
      body: gameIdResponse,
    }).as('getGameId');

    cy.intercept('GET', '**/players', {
      statusCode: 200,
      body: playersResponse,
    }).as('getPlayers');

    cy.intercept('GET', '**/game-records', {
      statusCode: 200,
      body: gameRecordsResponse,
    }).as('getGameRecords');

    cy.intercept('GET', '**/gamecenter/**/boxscore', {
      statusCode: gameInfoStatus,
      body: gameInfoResponse,
    }).as('getGameInfo');

    cy.intercept('GET', '**/schedule/**', {
      statusCode: 200,
      body: scheduleResponse,
    }).as('getSchedule');
  });
});
