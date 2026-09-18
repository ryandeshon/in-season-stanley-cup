import { apiRoute } from '../support/routes';
describe('Pinned story screen', () => {
  for (const [width, height] of [[1280, 720], [390, 844], [320, 640]]) {
    it(`keeps the picture below navigation through the full story at ${width}px`, () => {
      cy.viewport(width, height);
      cy.mockApiScenario('cup-day-multiple-games');
      cy.intercept(apiRoute('GET', '/seasons'), { body: {
        defaultSeason: 'season3', seasons: [{ id: 'season3', label: 'Season 3', status: 'active' }],
      } });
      cy.visit('/story', { onBeforeLoad(win) { win.localStorage.setItem('selectedSeason', 'season3'); } });
      cy.get('.story-console').should('be.visible');
      cy.document().then(doc => doc.fonts.ready);
      cy.get('.story-page').then(([page]) => {
        const navBottom = page.ownerDocument.querySelector('.v-app-bar').getBoundingClientRect().bottom;
        const win = page.ownerDocument.defaultView;
        const start = page.getBoundingClientRect().top + win.scrollY + parseFloat(win.getComputedStyle(page).paddingTop) - navBottom - 10;
        for (const progress of [0.1, 0.5, 0.9, 1]) {
          cy.scrollTo(0, start + 2400 * progress);
          cy.get('.story-stage').should(([stage]) => {
            expect(stage.getBoundingClientRect().top).to.be.closeTo(navBottom + 10, 1);
          });
          cy.get('.br-picture').should(([picture]) => {
            const rect = picture.getBoundingClientRect();
            expect(rect.top).to.be.greaterThan(navBottom);
            expect(rect.height).to.be.greaterThan(70);
            expect(rect.bottom).to.be.at.most(height - 10);
          });
          cy.get('[role=progressbar]').should('have.attr', 'aria-valuenow', String(progress * 60));
          if (progress === 0.5) cy.screenshot(`story-pinned-${width}`, { capture: 'viewport' });
        }
        cy.scrollTo(0, start + 2600);
        cy.get('.story-stage').should(([stage]) => {
          expect(stage.getBoundingClientRect().top).to.be.lessThan(navBottom + 10);
        });
      });
    });
  }
});
