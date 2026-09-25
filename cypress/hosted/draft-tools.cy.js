const key = 'inseason-local-draft-v1';
const control = (name) => cy.get(`[data-test="draft-admin-${name}"]`);
const state = () =>
  cy.window().then((win) => JSON.parse(win.localStorage.getItem(key)).state);
describe('Hosted Test local draft', () => {
  it('starts, picks, persists, locks, undoes and resets without backend traffic or codes', () => {
    cy.intercept({ hostname: /execute-api\..*amazonaws\.com$/ }, () => {
      throw Error('Local draft must not contact a backend');
    });
    cy.on('window:before:load', (win) => {
      win.WebSocket = class {
        constructor() {
          throw Error('Local draft must not open a WebSocket');
        }
      };
    });
    cy.visit('/draft/admin', {
      onBeforeLoad(win) {
        win.localStorage.removeItem(key);
      },
    });
    cy.contains('BROWSER-LOCAL PRACTICE').should('be.visible');
    cy.contains('label', 'Admin token').should('not.exist');
    control('start').click();
    state().its('currentPicker').should('eq', 4);
    control('advance').click();
    state().its('pickHistory').should('have.length', 1);
    cy.reload();
    control('lock-toggle').click();
    state().its('isLocked').should('eq', true);
    control('lock-toggle').click();
    control('undo').click();
    state().its('pickHistory').should('have.length', 0);
    cy.visit('/draft/Terry?draftTest=1');
    cy.get('[data-test="draft-access-code"]').should('not.exist');
    cy.get('[data-test="draft-team-card-ANA"]').click();
    state().its('pickHistory').should('have.length', 1);
    cy.visit('/draft/admin');
    control('reset').click();
    control('reset-confirm').click();
    state().its('draftStarted').should('eq', false);
    state().its('pickHistory').should('have.length', 0);
    cy.contains('a', 'Back to game scenarios').click();
    cy.contains('DESIGN PREVIEW').should('be.visible');
    cy.contains('a', 'Test the draft locally').click();
    control('start').should('be.visible');
  });
  it('delivers countdown picks to a second browser context through local storage events', () => {
    cy.visit('/draft/admin', {
      onBeforeLoad(win) {
        win.localStorage.removeItem(key);
      },
    });
    control('start').should('be.visible');
    cy.document().then((doc) => {
      const frame = doc.createElement('iframe');
      frame.id = 'practice-player';
      frame.src = '/draft/Terry';
      frame.style.height = '400px';
      doc.body.appendChild(frame);
    });
    const player = () =>
      cy
        .get('#practice-player')
        .its('0.contentDocument.body')
        .should('not.be.empty')
        .then(cy.wrap);
    player()
      .find('[data-test="test-socket-status"]')
      .should('contain', 'Connected');
    control('autopick-enabled').click();
    control('autopick-seconds').clear().type('5');
    control('start').click();
    player().find('[data-test="draft-team-card-ANA"]').should('exist');
    cy.window({ timeout: 10000 }).should((win) => {
      expect(
        JSON.parse(win.localStorage.getItem(key)).state.pickHistory.length
      ).to.be.greaterThan(0);
    });
    control('lock-toggle').click();
    player().find('[data-test="draft-player-locked-banner"]').should('exist');
    player()
      .find('[data-test="test-socket-events"]')
      .should('not.contain', 'Events received: 0');
  });
  it('fits controls and player portraits at desktop, tablet and phone widths', () => {
    cy.visit('/draft/admin', {
      onBeforeLoad(win) {
        win.localStorage.removeItem(key);
      },
    });
    control('start').should('be.visible');
    cy.contains('.v-card-title', 'Draft Controls').should('not.exist');
    cy.contains('.v-card-title', 'Draft Progress').should('not.exist');
    [1280, 820, 390].forEach((width) => {
      cy.viewport(width, 900);
      cy.get('.draft-page .v-btn').each((button) => {
        const label = button[0]
          .querySelector('.v-btn__content')
          .getBoundingClientRect();
        const box = button[0].getBoundingClientRect();
        expect(label.left).to.be.at.least(box.left);
        expect(label.right).to.be.at.most(box.right + 1);
        expect(label.bottom).to.be.at.most(box.bottom + 1);
      });
      cy.get('.draft-player-card').should((cards) => {
        expect(cards.length).to.eq(4);
        const boxes = [...cards].map((card) => card.getBoundingClientRect());
        boxes.forEach((box) => expect(box.width).to.be.greaterThan(130));
        boxes.forEach((box, index) =>
          boxes.slice(index + 1).forEach((other) => {
            expect(
              box.right <= other.left ||
                other.right <= box.left ||
                box.bottom <= other.top ||
                other.bottom <= box.top,
              'portraits do not overlap'
            ).to.eq(true);
          })
        );
      });
    });
    cy.get('.draft-rosters').screenshot('draft-rosters-phone');
    cy.viewport(1280, 900);
    cy.get('.draft-rosters').screenshot('draft-rosters-desktop');
    control('start').click();
    cy.visit('/draft/Terry');
    cy.contains('.v-chip', 'Unlocked').should('not.exist');
    cy.contains('.draft-notice-green', "It's your turn").should('be.visible');
  });
});
