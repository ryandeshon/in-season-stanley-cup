import { apiRoute, nhlRoute } from '../support/routes';
function setup(offDay = false) {
  cy.mockApiScenario(offDay ? 'no-games' : 'cup-day-multiple-games');
  cy.intercept(apiRoute('GET', '/seasons'), {
    body: {
      defaultSeason: 'season3',
      seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
    },
  });
  if (!offDay) {
    cy.fixture('cup-day-multiple-games').then((data) => {
      cy.intercept(nhlRoute('/gamecenter/**/boxscore'), {
        body: {
          ...data.gameInfoResponse,
          gameState: 'FUT',
          startTimeUTC: new Date(
            Date.parse(data.gameInfoResponse.startTimeUTC) + 3600000
          ).toISOString(),
        },
      });
    });
  }
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem('selectedSeason', 'season3');
    },
  });
}
describe('3.0.5 mobile countdown', () => {
  for (const width of [320, 390]) {
    it(`shows larger logos and a countdown at ${width}px`, () => {
      cy.viewport(width, 844);
      setup();
      cy.get('.hud-team .v-img').each((logo) => {
        expect(logo[0].getBoundingClientRect().width).to.equal(64);
        expect(logo[0].getBoundingClientRect().height).to.equal(64);
      });
      cy.get('.arena-start [data-test="game-countdown"]').should(
        'contain',
        'Faceoff in 1h 00m 00s'
      );
      cy.get('.arena-start time')
        .invoke('attr', 'datetime')
        .then((value) => {
          const localHour = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date(value));
          cy.get('.arena-start time').should('contain', localHour);
        });
      cy.document().then((doc) =>
        expect(doc.documentElement.scrollWidth).to.be.at.most(width)
      );
      cy.screenshot(`305-countdown-${width}`, { capture: 'viewport' });
    });
  }
  it('counts down to the first defense on an off day', () => {
    cy.viewport(390, 844);
    setup(true);
    cy.get(
      '[data-test="whats-next-panel"] [data-test="game-countdown"]'
    ).should('contain', 'Faceoff in 1d 7h 00m 00s');
    cy.get('[data-test="game-countdown"] time').should(
      'have.attr',
      'datetime',
      '2024-11-02T19:00:00Z'
    );
  });
});
