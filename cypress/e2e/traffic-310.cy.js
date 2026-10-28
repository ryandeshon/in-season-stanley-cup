import { apiRoute } from '../support/routes';
describe('3.1.0 idle draft traffic', () => {
  for (const route of ['/draft/Ryan', '/draft/admin']) {
    it(`${route} stops HTTP polling after the final pick`, () => {
      cy.mockDraftScenario('draft-default');
      cy.intercept(apiRoute('GET', '/draft/state'), {
        body: {
          draftStarted: true,
          availableTeams: [],
          currentPicker: null,
          currentPickNumber: 33,
          pickOrder: [1, 2, 3, 4],
          version: 40,
          isLocked: true,
          autoPickEnabled: false,
          pickHistory: [],
        },
      }).as('completedDraft');
      cy.clock();
      cy.visit(route);
      cy.wait(['@completedDraft', '@getDraftPlayers']);
      cy.tick(3600000);
      cy.get('@completedDraft.all').should('have.length', 1);
      cy.get('@getDraftPlayers.all').should('have.length', 1);
    });
  }
});
