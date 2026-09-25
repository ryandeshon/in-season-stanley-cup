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
    player()
      .find('[data-test="draft-player-locked-banner"]')
      .should('exist');
    player()
      .find('[data-test="test-socket-events"]')
      .should('not.contain', 'Events received: 0');
  });
});
