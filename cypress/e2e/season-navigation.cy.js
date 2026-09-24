import { apiRoute } from '../support/routes';

// Different rosters/totals make accidental reuse of the current season observable.
function mockSeasons({ emptyArchive = false } = {}) {
  cy.mockApiScenario('cup-day-multiple-games');
  cy.fixture('cup-day-multiple-games').then((data) => {
    const archive = [
      {
        id: 1,
        name: 'Ryan',
        teams: ['ANA'],
        titleDefenses: 19,
        totalDefenses: 31,
        championships: 2,
      },
      {
        id: 2,
        name: 'Cooper',
        teams: ['BOS'],
        titleDefenses: 8,
        totalDefenses: 20,
        championships: 1,
      },
    ];
    cy.intercept(apiRoute('GET', '/players{,/**}'), (req) => {
      const url = new URL(req.url);
      req.alias = `${url.searchParams.get('season')}Players`;
      const players =
        url.searchParams.get('season') === 'season1'
          ? archive
          : data.playersResponse;
      const player = url.pathname.split('/players/')[1];
      req.reply(
        player
          ? players.find((p) => p.name === decodeURIComponent(player))
          : players
      );
    }).as('seasonPlayers');
    cy.intercept(apiRoute('GET', '/game-records'), (req) => {
      req.alias = `${new URL(req.url).searchParams.get('season')}Games`;
      const historical =
        new URL(req.url).searchParams.get('season') === 'season1';
      req.reply(
        historical
          ? emptyArchive
            ? []
            : [
                {
                  id: 2023021111,
                  wTeam: 'ANA',
                  lTeam: 'BOS',
                  wScore: 3,
                  lScore: 2,
                },
              ]
          : data.gameRecordsResponse
      );
    }).as('seasonGames');
  });
}
function switchSeason(number) {
  cy.get('[data-test="navigation-menu"]').click();
  // Vuetify disables pointer events on this keyboard input; target it directly.
  cy.get('[data-test="season-select"] input').focus().type(String(number), { force: true });
  cy.get('[data-test="season-select"]').should('contain', String(number));
  cy.get('[data-test="navigation-menu"]').click();
}

describe('Season navigation', () => {
  it('switches historical ownership and totals on mobile through standings and profile', () => {
    mockSeasons();
    cy.viewport(390, 844);
    cy.visit('/standings');
    cy.wait('@season2Players')
      .its('request.query.season')
      .should('eq', 'season2');
    switchSeason(1);
    cy.wait('@season1Players')
      .its('request.query.season')
      .should('eq', 'season1');
    cy.contains('tr', 'Ryan')
      .should('contain', '19')
      .find('[alt="ANA"]')
      .should('exist');
    cy.contains('tr', 'Ryan').find('a').click();
    cy.wait('@season1Players');
    cy.contains('Title Defenses: 19').should('be.visible');
    cy.contains('Lifetime Defenses: 31').should('be.visible');
    cy.get('[data-test="player-profile-head-to-head-row-cooper"]').should(
      'contain',
      '1 - 0'
    );
    switchSeason(2);
    cy.wait('@season2Players')
      .its('request.query.season')
      .should('eq', 'season2');
    cy.contains('Title Defenses: 19').should('not.exist');
    cy.window()
      .its('localStorage')
      .invoke('getItem', 'selectedSeason')
      .should('eq', 'season2');
  });
  it('preserves the selected season from home to game details and back', () => {
    mockSeasons();
    cy.visit('/');
    cy.wait('@getGameInfo');
    switchSeason(1);
    cy.wait('@season1Players')
      .its('request.query.season')
      .should('eq', 'season1');
    // BOS belongs to Cooper in the historical roster, not Ryan.
    cy.get('[data-test="champion-select-card"]').should('contain', 'Cooper');
    cy.get('[data-test="view-game-details-link"]').click();
    cy.wait('@getGameInfo');
    cy.contains('Game Details').should('be.visible');
    cy.window()
      .its('localStorage')
      .invoke('getItem', 'selectedSeason')
      .should('eq', 'season1');
    cy.go('back');
    cy.get('[data-test="champion-select-card"]').should('contain', 'Cooper');
  });
  it('clears old history when switching to a season with no games', () => {
    mockSeasons({ emptyArchive: true });
    cy.visit('/player/Ryan');
    cy.wait('@seasonGames');
    switchSeason(1);
    cy.wait('@seasonGames').its('request.query.season').should('eq', 'season1');
    cy.get('[data-test="player-profile-no-games"]').should('be.visible');
    cy.get('[data-test="player-profile-history-panel"]').should('not.exist');
    cy.get('[data-test="player-profile-head-to-head-row-cooper"]').should(
      'contain',
      '0 - 0'
    );
  });
});
