import { apiRoute, nhlRoute } from '../support/routes';
function setup() {
  cy.mockApiScenario('cup-day-multiple-games');
  cy.intercept(apiRoute('GET', '/seasons'), {
    body: {
      storageVersion: 'v2',
      defaultSeason: 'season3',
      seasons: [
        { id: 'season2', label: 'Season 2', status: 'archived' },
        { id: 'season3', label: 'Season 3', status: 'active' },
      ],
    },
  });
  cy.intercept(apiRoute('GET', '/season/meta'), {
    body: { seasonId: 'season3', seasonOver: false },
  });
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem('selectedSeason', 'season3');
    },
  });
  cy.get('[data-test="arcade-arena"]').should('be.visible');
}
describe('Season 3 arcade review', () => {
  it('keeps score, preview selection, profile links and game details usable', () => {
    setup();
    cy.get('.hud-score').should('contain', '2').and('contain', '1');
    cy.get('[data-test="home-title"]').should('not.exist');
    cy.get('.arcade-navigation').should('not.exist');
    cy.get('.fighter-foot').first().scrollIntoView();
    cy.get('.fighter-foot img')
      .first()
      .should('have.attr', 'src')
      .and('include', 'assets.nhle.com/logos/nhl/svg/BOS_');
    cy.get('[data-test="navigation-menu"]').click();
    cy.contains('.v-list-item', /Light Mode|Dark Mode/).click();
    cy.get('body')
      .invoke('attr', 'data-mode')
      .then((mode) => {
        cy.get('.v-application').should(
          'have.class',
          `v-theme--season3-${mode}`
        );
        cy.contains('.v-list-item', /Light Mode|Dark Mode/).click();
        cy.get('body').should(
          'have.attr',
          'data-mode',
          mode === 'light' ? 'dark' : 'light'
        );
      });
    cy.get('[data-test="navigation-menu"]').click();
    cy.get('.quiet-control')
      .contains('Sound off')
      .should('have.attr', 'aria-pressed', 'false');
    cy.get('[data-test="challenger-select-card"] button').click();
    cy.get('[data-test="conditional-matchups-section"]').should(
      'contain',
      'PREVIEW'
    );
    cy.get('[data-test="challenger-select-card"]').should(
      'have.class',
      'selected'
    );
    cy.get('[data-test="view-game-details-link"]').should(
      'have.attr',
      'href',
      '/game/2024021111'
    );
    cy.screenshot('arcade-desktop', { capture: 'fullPage' });
    cy.get('.fighter-label a').contains('Cooper').click();
    cy.get('.arcade-dossier').should('contain', 'The Former Steward');
    cy.get('[data-test="player-profile-trend-panel"]').should('be.visible');
  });
  it('fits both fighters and readable scoreboard on a 320px phone', () => {
    cy.viewport(320, 780);
    setup();
    cy.get('.fighter').should('have.length', 2);
    cy.document().then((doc) =>
      expect(doc.documentElement.scrollWidth).to.be.at.most(320)
    );
    cy.get('.arena-hud').should('be.visible');
    cy.screenshot('arcade-mobile', { capture: 'fullPage' });
    cy.get('[data-test="navigation-menu"]').click();
    cy.contains('.v-list-item', 'Standings').click();
    cy.get('table').should('contain', 'Title Defenses');
    cy.get('.rank-portrait').should('have.length', 4);
  });
  it('shows data-driven final winner and conservative shutout badge with manual replay', () => {
    cy.mockApiScenario('cup-day-multiple-games');
    cy.fixture('cup-day-multiple-games').then((data) => {
      data.gameInfoResponse.gameState = 'FINAL';
      data.gameInfoResponse.homeTeam.score = 0;
      data.gameInfoResponse.awayTeam.score = 3;
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
      },
    });
    cy.get('[data-test="flawless-victory"]').should('be.visible');
    cy.get('.victory-heading').should('contain', 'Cooper');
    cy.get('[data-test="arcade-arena"]').should('have.class', 'phase-idle');
    cy.contains('button', 'Replay fatality').click();
    cy.get('[data-test="arcade-arena"]').should('have.class', 'phase-finish');
    cy.get('[data-test="view-game-details-link"]').should('be.visible');
  });
  it('provides optional scroll, timed, pause, chapter and skip story controls', () => {
    setup();
    cy.get('[data-test="navigation-menu"]').click();
    cy.contains('.v-list-item', 'The Black Rink story').click();
    cy.get('.story-scene:visible').should('have.length', 1);
    cy.get('.story-scene').should('contain', 'Ryan claimed the championship');
    cy.get('.br-controls').scrollIntoView();
    cy.contains('button', 'Play intro').click({ scrollBehavior: false });
    cy.get('.story-scene:visible').should('have.length', 1);
    cy.contains('button', 'Pause').click({ scrollBehavior: false });
    cy.contains('button', 'Resume').should('be.visible');
    cy.contains('button', 'III · The trap').click();
    cy.get('.story-scene:visible').should('contain', 'The gates close');
    cy.get('[aria-label="Story time in seconds"]').should('have.value', '40');
    cy.scrollTo(0, 0);
    cy.get('.story-scene').should('contain', 'Ryan claimed the championship');
    cy.screenshot('arcade-story', { capture: 'fullPage' });
    cy.contains('a', 'Skip to the arena').click();
    cy.get('[data-test="arcade-arena"]').should('be.visible');
  });
});
