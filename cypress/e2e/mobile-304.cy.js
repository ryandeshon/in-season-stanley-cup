import { apiRoute } from '../support/routes';
function setup(path) {
  cy.mockApiScenario('cup-day-multiple-games');
  cy.intercept(apiRoute('GET', '/seasons'), {
    body: {
      defaultSeason: 'season3',
      seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
    },
  });
  cy.fixture('cup-day-multiple-games').then((data) => {
    data.playersResponse[0].teams = [
      'BOS',
      'EDM',
      'BUF',
      'ANA',
      'LAK',
      'NJD',
      'OTT',
      'NSH',
    ];
    cy.intercept(apiRoute('GET', '/players'), { body: data.playersResponse });
  });
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('selectedSeason', 'season3');
    },
  });
}
function noOverflow() {
  cy.document().then((doc) =>
    expect(doc.documentElement.scrollWidth).to.be.at.most(
      doc.documentElement.clientWidth
    )
  );
}
describe('3.0.4 mobile spacing', () => {
  for (const width of [320, 390]) {
    it(`stacks standings identity and keeps headers compact at ${width}px`, () => {
      cy.viewport(width, 844);
      setup('/standings');
      cy.get('.standing-identity').should('have.length', 4);
      cy.get('.standing-player')
        .first()
        .should('have.css', 'flex-direction', 'column');
      cy.get('.standing-champion').should('be.visible');
      cy.get('.compact-mobile-table th').each((th) =>
        expect(parseFloat(th.css('font-size'))).to.equal(12)
      );
      noOverflow();
      cy.screenshot(`304-standings-${width}`, { capture: 'viewport' });
    });
  }
  it('reduces the mobile game summary and roster gap', () => {
    cy.viewport(390, 844);
    setup('/game/2024021111');
    cy.get('.game-details-summary')
      .should('be.visible')
      .and('have.css', 'padding-bottom', '12px');
    cy.get('.game-matchup .v-img').first().should('have.css', 'height', '64px');
    cy.get('.game-details-rosters').should('be.visible');
    cy.get('.game-details-summary').then((summary) => {
      cy.get('.game-details-rosters').then((rosters) => {
        const gap =
          rosters[0].getBoundingClientRect().top -
          summary[0].getBoundingClientRect().bottom;
        expect(gap).to.be.at.most(20);
      });
    });
    noOverflow();
    cy.screenshot('304-game-details', { capture: 'viewport' });
  });
  it('uses the same compact headings for upcoming games', () => {
    cy.viewport(390, 844);
    cy.mockApiScenario('no-games');
    cy.intercept(apiRoute('GET', '/seasons'), {
      body: {
        defaultSeason: 'season3',
        seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
      },
    });
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('selectedSeason', 'season3');
      },
    });
    cy.get('.compact-mobile-table th')
      .should('have.length.at.least', 3)
      .each((th) => expect(parseFloat(th.css('font-size'))).to.equal(12));
    noOverflow();
  });
});
