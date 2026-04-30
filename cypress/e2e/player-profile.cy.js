describe.skip('In Season Cup - Player Profile', () => {
  beforeEach(() => {
    cy.mockApiScenario('player-profile-head-to-head');
  });

  it('shows head-to-head avatars above team records with expected records/order', () => {
    cy.visit('/player/Ryan');
    cy.wait('@getPlayers');
    cy.wait('@getGameRecords');

    cy.get('[data-test="player-profile-head-to-head-panel"]').should('exist');
    cy.get('[data-test="player-profile-team-records-panel"]').should('exist');
    cy.get('[data-test="player-profile-head-to-head-panel"]')
      .nextAll('[data-test="player-profile-team-records-panel"]')
      .should('have.length', 1);

    cy.get('tr[data-test^="player-profile-head-to-head-row-"]').then(
      ($rows) => {
        const order = [...$rows].map((row) => row.getAttribute('data-test'));
        expect(order).to.deep.equal([
          'player-profile-head-to-head-row-boz',
          'player-profile-head-to-head-row-cooper',
          'player-profile-head-to-head-row-terry',
        ]);
      }
    );

    cy.get('[data-test="player-profile-head-to-head-row-boz"]').should(
      'contain',
      '1 - 1'
    );
    cy.get('[data-test="player-profile-head-to-head-row-cooper"]').should(
      'contain',
      '1 - 1'
    );
    cy.get('[data-test="player-profile-head-to-head-row-terry"]').should(
      'contain',
      '0 - 1'
    );

    cy.get('[data-test="player-profile-head-to-head-row-terry"] img')
      .should('have.class', 'head-to-head-avatar')
      .and('have.attr', 'alt')
      .and('contain', 'Happy');
  });

  it('navigates to the clicked opponent profile avatar and refreshes profile data', () => {
    cy.visit('/player/Ryan');
    cy.wait('@getPlayers');
    cy.wait('@getGameRecords');

    cy.get('[data-test="player-profile-head-to-head-row-boz"] a').click();

    cy.url().should('include', '/player/Boz');
    cy.contains('Title Defenses: 1');
    cy.get('[data-test="player-profile-head-to-head-row-boz"]').should(
      'not.exist'
    );
    cy.get('[data-test="player-profile-head-to-head-row-ryan"]').should('exist');
  });
});
