describe('Debug Intercepts', () => {
  it('verifies intercepts are working', () => {
    cy.intercept('GET', /\/api\/test/, {
      statusCode: 200,
      body: { message: 'intercepted' },
    }).as('testRequest');

    cy.visit('/');

    // Log the environment variables
    cy.window().then((win) => {
      cy.log('VUE_APP_API_BASE:', win.__VUE_APP_API_BASE__ || 'not set');
    });
  });
});
