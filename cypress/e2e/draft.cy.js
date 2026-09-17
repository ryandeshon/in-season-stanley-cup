import { apiRoute } from '../support/routes';

describe('Draft flows', () => {
  context('Participant interactions', () => {
    beforeEach(() => {
      cy.mockDraftScenario('draft-default');
    });

    it('allows the active picker to select a team with optimistic versioning', () => {
      cy.visit('/draft/Ryan');
      cy.wait(['@getDraftPlayers', '@getDraftState']);

      cy.contains('Disconnected. Trying to reconnect...').should('exist');
      cy.get('[data-test="draft-player-autopick-countdown"]').should('exist');
      cy.get('[data-test="draft-team-card-BOS"]').click();

      cy.wait('@pickDraftTeam').then(({ request }) => {
        expect(request.body.team).to.eq('BOS');
        expect(request.body.version).to.eq(7);
      });
    });

    it('shows a conflict message when draft version is stale', () => {
      cy.intercept(apiRoute('POST', '/draft/pick'), {
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
            isLocked: false,
            autoPickEnabled: false,
            autoPickSeconds: 60,
            autoPickDeadlineAt: null,
            pickHistory: [],
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

    it('covers start, lock/unlock, countdown, advance, undo, and reset controls', () => {
      cy.visit('/draft/admin');
      cy.wait(['@getDraftPlayers', '@getDraftState']);

      cy.contains('Disconnected. Trying to reconnect...').should('exist');

      cy.get('[data-test="draft-admin-start"]').click();
      cy.wait('@patchDraftState').its('request.body.version').should('eq', 3);
      cy.get('[data-test="draft-admin-snackbar"]').should(
        'contain',
        'Draft started successfully.'
      );

      cy.get('[data-test="draft-admin-autopick-enabled"]').click();
      cy.get('[data-test="draft-admin-autopick-seconds"]').clear().type('25');
      cy.get('[data-test="draft-admin-autopick-save"]').click();
      cy.wait('@patchDraftState')
        .its('request.body.autoPickEnabled')
        .should('eq', true);

      cy.get('[data-test="draft-admin-lock-toggle"]').click();
      cy.wait('@patchDraftState')
        .its('request.body.isLocked')
        .should('eq', true);
      cy.get('[data-test="draft-admin-lock-toggle"]').click();
      cy.wait('@patchDraftState')
        .its('request.body.isLocked')
        .should('eq', false);

      cy.get('[data-test="draft-admin-advance"]').click();
      cy.wait('@pickDraftTeam');

      cy.get('[data-test="draft-admin-undo"]').click();
      cy.wait('@undoDraftPick');

      cy.get('[data-test="draft-admin-reset"]').click();
      cy.get('[data-test="draft-admin-reset-dialog"]').should('be.visible');
      cy.get('[data-test="draft-admin-reset-confirm"]').click();
      cy.wait('@resetDraftTeams');
    });
  });
});

describe('Draft safety and recovery', () => {
  function scenario(patch = {}) {
    cy.mockDraftScenario('draft-default');
    cy.fixture('draft-default').then(({ draftState }) => {
      cy.intercept(apiRoute('GET', '/draft/state'), {
        ...draftState,
        ...patch,
      }).as('state');
    });
  }
  it('rejects an out-of-turn participant without submitting a pick', () => {
    scenario();
    cy.intercept(apiRoute('POST', '/draft/pick'), () => {
      throw new Error('Out-of-turn pick submitted');
    });
    cy.visit('/draft/Cooper');
    cy.wait(['@getDraftPlayers', '@state']);
    cy.get('[data-test="draft-team-card-BOS"]').click();
    cy.contains("It's not your turn!").should('be.visible');
  });
  it('does not rewind a completed pick when an older state response arrives', () => {
    scenario();
    cy.visit('/draft/Ryan');
    cy.wait(['@getDraftPlayers', '@state']);
    cy.get('[data-test="draft-team-card-BOS"]').click();
    cy.wait('@pickDraftTeam');
    cy.wait('@state');
    cy.contains('span', 'Current Pick:').should('contain', 'Cooper');
  });
  it('prevents picks while locked', () => {
    scenario({ isLocked: true });
    cy.intercept(apiRoute('POST', '/draft/pick'), () => {
      throw new Error('Locked pick submitted');
    });
    cy.visit('/draft/Ryan');
    cy.wait(['@getDraftPlayers', '@state']);
    cy.get('[data-test="draft-player-locked-banner"]').should('be.visible');
    cy.get('[data-test="draft-team-card-BOS"]').should(
      'have.css',
      'pointer-events',
      'none'
    );
  });
  it('shows a completed draft with rosters and no pick controls', () => {
    scenario({ availableTeams: [] });
    cy.visit('/draft/Ryan');
    cy.wait(['@getDraftPlayers', '@state']);
    cy.contains('h1', 'Draft is Over').should('be.visible');
    cy.get('[data-test^="draft-team-card-"]').should('not.exist');
    cy.get('[data-test="draft-player-autopick-countdown"]').should('not.exist');
  });
  it('recovers from a failed load through disconnected polling', () => {
    cy.clock(Date.parse('2030-01-01T00:00:00Z'), [
      'Date',
      'setInterval',
      'clearInterval',
    ]);
    cy.mockDraftScenario('draft-default');
    cy.intercept(
      { ...apiRoute('GET', '/draft/state'), times: 2 },
      { statusCode: 503, body: { error: 'Try again' } }
    ).as('failedState');
    cy.visit('/draft/Ryan');
    cy.wait(['@failedState', '@failedState']);
    cy.get('[data-test="draft-player-load-error"]').should('be.visible');
    cy.tick(30000);
    cy.wait('@getDraftState');
    cy.get('[data-test="draft-player-load-error"]').should('not.exist');
    cy.contains('h1', 'Draft in Progress').should('be.visible');
  });
  it('admin auto-picks once when the deadline expires', () => {
    cy.clock(Date.parse('2099-01-01T00:00:29Z'), [
      'Date',
      'setInterval',
      'clearInterval',
    ]);
    cy.mockDraftScenario('draft-default');
    cy.visit('/draft/admin');
    cy.wait(['@getDraftPlayers', '@getDraftState']);
    cy.get('[data-test="draft-admin-autopick-countdown"]').should(
      'contain',
      '00:01'
    );
    cy.tick(1000);
    cy.wait('@pickDraftTeam').its('request.body.version').should('eq', 7);
    cy.wait('@getDraftState');
    cy.tick(1000);
    cy.get('@pickDraftTeam.all').should('have.length', 1);
  });
  it('shows an unavailable-team rejection and reloads the server state', () => {
    scenario();
    cy.intercept(apiRoute('POST', '/draft/pick'), {
      statusCode: 400,
      body: { error: 'Team is no longer available' },
    }).as('unavailable');
    cy.visit('/draft/Ryan');
    cy.wait(['@getDraftPlayers', '@state']);
    cy.get('[data-test="draft-team-card-BOS"]').click();
    cy.wait('@unavailable');
    cy.wait('@state');
    cy.get('[data-test="draft-player-snackbar"]').should(
      'contain',
      'Team is no longer available'
    );
  });
});
