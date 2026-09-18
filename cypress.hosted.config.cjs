const { defineConfig } = require('cypress');
module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8092',
    specPattern: 'cypress/hosted/*.cy.js',
    supportFile: false,
    video: false,
    viewportWidth: 1280,
    viewportHeight: 900,
  },
});
