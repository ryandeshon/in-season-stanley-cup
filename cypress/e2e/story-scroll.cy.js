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
      cy.get('input[type=range]').should('have.length', 1);
      cy.get('[role=progressbar]').should('not.exist');
      cy.get('.br-progress .sr-only').should('have.text', 'Story position');
      cy.get('.br-picture').then(([picture]) => {
        const fixedHeight = picture.getBoundingClientRect().height;
        cy.contains('button', 'Play intro').click({ scrollBehavior: false });
        cy.get('.br-copy').then(([copy]) => {
          const typingHeight = copy.getBoundingClientRect().height;
          cy.contains('button', 'Full text').click({ scrollBehavior: false });
          cy.get('.br-copy').should(([fullCopy]) => {
            expect(fullCopy.getBoundingClientRect().height).to.be.at.least(typingHeight);
          });
        });
        for (const chapter of ['The seizure', 'The survivors', 'The trap']) {
          cy.contains('nav button', chapter).click();
          cy.get('.br-picture').should(([image]) => {
            expect(image.getBoundingClientRect().height).to.be.closeTo(fixedHeight, 1);
          });
          cy.get('.br-copy').scrollTo('bottom', { ensureScrollable: false });
          cy.get('.br-copy').should(([copy]) => {
            expect(copy.clientHeight).to.be.greaterThan(35);
            expect(copy.scrollHeight - copy.clientHeight - copy.scrollTop).to.be.at.most(1);
            expect(getComputedStyle(copy.querySelector('p')).color).to.equal('rgb(255, 255, 255)');
          });
        }
      });
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
          cy.get('input[type=range]').should('have.value', String(progress * 60));
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
