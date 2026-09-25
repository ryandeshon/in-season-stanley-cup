import { apiRoute, nhlRoute } from '../support/routes';
const attacks = {
  Ryan: 'fire',
  Cooper: 'lightning',
  Terry: 'acid',
  Boz: 'orb',
};
function setup(name, side, fallback = '') {
  cy.mockApiScenario('cup-day-multiple-games');
  cy.fixture('cup-day-multiple-games').then((original) => {
    const data = structuredClone(original);
    const opponent = name === 'Ryan' ? 'Cooper' : 'Ryan';
    data.playersResponse.forEach((p) => {
      p.teams = [];
    });
    data.playersResponse.find((p) => p.name === name).teams = [
      side === 'left' ? 'BOS' : 'TOR',
    ];
    data.playersResponse.find((p) => p.name === opponent).teams = [
      side === 'left' ? 'TOR' : 'BOS',
    ];
    data.gameInfoResponse.gameState = 'FINAL';
    data.gameInfoResponse.homeTeam.score = side === 'left' ? 3 : 0;
    data.gameInfoResponse.awayTeam.score = side === 'left' ? 0 : 3;
    cy.intercept(apiRoute('GET', '/players'), { body: data.playersResponse });
    cy.intercept(nhlRoute('/gamecenter/**/boxscore'), {
      body: data.gameInfoResponse,
    });
  });
  cy.intercept(apiRoute('GET', '/seasons'), {
    body: {
      defaultSeason: 'season3',
      seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
    },
  });
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem('selectedSeason', 'season3');
      win.attackDraws = 0;
      for (const Context of [
        win.WebGLRenderingContext,
        win.WebGL2RenderingContext,
      ]) {
        if (!Context) continue;
        const draw = Context.prototype.drawElements;
        Context.prototype.drawElements = function (...args) {
          win.attackDraws++;
          return draw.apply(this, args);
        };
      }
      if (fallback === 'motion') {
        const match = win.matchMedia.bind(win);
        win.matchMedia = (query) =>
          query === '(prefers-reduced-motion: reduce)'
            ? { matches: true, addEventListener() {}, removeEventListener() {} }
            : match(query);
      }
      if (fallback === 'gpu') {
        const getContext = win.HTMLCanvasElement.prototype.getContext;
        win.HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return type.includes('webgl')
            ? null
            : getContext.call(this, type, ...args);
        };
      }
    },
  });
  cy.get('.victory-heading').should('contain', name);
}
describe('PixiJS attacks', () => {
  for (const [name, attack] of Object.entries(attacks)) {
    for (const side of ['left', 'right']) {
      it(`renders ${attack} from ${side} and retains its final overlay`, () => {
        cy.viewport(side === 'right' ? 390 : 1280, 1100);
        setup(name, side);
        cy.get('.attack-canvas').should('have.attr', 'data-renderer', 'pixi');
        cy.get('.attack-canvas canvas').should('be.visible');
        cy.get('.fighter .portrait-visual')
          .should('have.length', 2)
          .each((p) => expect(p.attr('data-art')).to.equal('expressions'));
        cy.get('.fighter.victory .portrait-visual').should(
          'have.attr',
          'data-emotion',
          'Happy'
        );
        cy.get('.fighter.defeated .portrait-visual').should(
          'have.attr',
          'data-emotion',
          'Sad'
        );
        cy.contains('button', 'Replay fatality').click();
        cy.get('.arcade-arena')
          .should('have.class', `attack-${attack}`)
          .and('have.class', `from-${side}`);
        // Let the actual GPU ticker reach the impact, not just the Vue phase.
        cy.get('.is-receiver .body-impact').should('not.be.visible');
        cy.get('.arcade-arena').should('have.class', 'phase-finish');
        cy.wait(600);
        cy.window().then((win) => {
          const draws = win.attackDraws;
          cy.wait(120);
          cy.window().its('attackDraws').should('be.greaterThan', draws);
        });
        cy.get('.fighters').screenshot(`pixi-${attack}-${side}`, {
          disableTimersAndAnimations: false,
        });
        cy.get('[data-test="fatality-overlay"]', { timeout: 7000 }).should(
          'be.visible'
        );
        cy.get('.arcade-arena', { timeout: 7000 }).should(
          'have.class',
          'phase-idle'
        );
        cy.get('[data-test="fatality-overlay"]').should('be.visible');
        cy.get('.victory-heading').should('contain', name);
      });
    }
  }
  it('preserves the static result without allocating a canvas for reduced motion', () => {
    setup('Ryan', 'left', 'motion');
    cy.contains('button', 'Replay fatality').click();
    cy.get('.arcade-arena').should('have.class', 'phase-finish-call');
    cy.get('.attack-canvas canvas').should('not.exist');
    cy.get('.victory-heading').should('contain', 'Ryan');
  });
  it('keeps the app usable when WebGL is unavailable', () => {
    setup('Cooper', 'right', 'gpu');
    cy.get('.attack-canvas').should('have.attr', 'data-renderer', 'fallback');
    cy.contains('button', 'Replay fatality').click();
    cy.get('.arcade-arena').should('have.class', 'phase-finish');
    cy.get('.victory-heading').should('contain', 'Cooper');
  });
});
