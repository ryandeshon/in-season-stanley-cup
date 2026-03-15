describe('Draft flows', () => {
  context('Participant interactions', () => {
    beforeEach(() => {
      cy.mockDraftScenario('draft-default');
    });

    it('allows the active picker to select a team with optimistic versioning', () => {
      cy.visit('/draft/Ryan');
      cy.wait(['@getDraftPlayers', '@getDraftState']);

      cy.contains('Disconnected. Trying to reconnect...').should('exist');
      cy.get('[data-test="draft-team-card-BOS"]').click();

      cy.wait('@selectDraftTeam')
        .its('request.body.team')
        .should('eq', 'BOS');
      cy.wait('@patchDraftState')
        .its('request.body.version')
        .should('eq', 7);
    });

    it('shows a conflict message when draft version is stale', () => {
      cy.intercept('PATCH', '**/draft/state*', {
        statusCode: 409,
        body: {
          error: 'Draft state version conflict',
          currentVersion: 8,
          currentState: {
            draftStarted: true,
            pickOrder: [1, 2, 3],
            currentPicker: 2,
            currentPickNumber: 2,
            availableTeams: ['ANA', 'TOR'],
            version: 8,
          },
        },
      }).as('forcedDraftConflict');

      cy.visit('/draft/Ryan');
      cy.wait(['@getDraftPlayers', '@getDraftState']);
      cy.get('[data-test="draft-team-card-BOS"]').click();
      cy.wait('@forcedDraftConflict');
      cy.get('[data-test="draft-player-snackbar"]').should(
        'contain',
        'Draft changed in another session. Loaded the latest state.'
      );
    });
  });

  context('Admin controls', () => {
    beforeEach(() => {
      cy.mockDraftScenario('draft-not-started');
    });

    it('covers start, advance, and reset controls', () => {
      cy.visit('/draft/admin');
      cy.wait(['@getDraftPlayers', '@getDraftState']);

      cy.contains('Disconnected. Trying to reconnect...').should('exist');

      cy.get('[data-test="draft-admin-start"]').click();
      cy.wait('@patchDraftState')
        .its('request.body.version')
        .should('eq', 3);
      cy.get('[data-test="draft-admin-snackbar"]').should(
        'contain',
        'Draft started successfully.'
      );

      cy.get('[data-test="draft-admin-advance"]').click();
      cy.wait('@selectDraftTeam');
      cy.wait('@patchDraftState');

      cy.get('[data-test="draft-admin-reset"]').click();
      cy.get('[data-test="draft-admin-reset-dialog"]').should('be.visible');
      cy.get('[data-test="draft-admin-reset-confirm"]').click();
      cy.wait('@resetDraftTeams');
    });
  });
});
