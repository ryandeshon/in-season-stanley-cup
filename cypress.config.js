const { defineConfig } = require('cypress');
const fs = require('node:fs');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8080',
    fixturesFolder: 'cypress/fixtures',
    supportFile: 'cypress/support/e2e.js',
    video: false,
    viewportWidth: 1280,
    viewportHeight: 720,
    setupNodeEvents(on, config) {
      on('after:run', (results) => {
        fs.mkdirSync('cypress/results', { recursive: true });
        fs.writeFileSync(
          'cypress/results/run.json',
          JSON.stringify(results, null, 2)
        );
        if (
          !results.totalTests ||
          (config.env.requireFullSuite && results.totalTests < 29) ||
          results.totalPending > 0 ||
          results.totalSkipped > 0
        ) {
          throw new Error(
            'Browser gate requires executed tests with no pending/skipped cases.'
          );
        }
      });
      return config;
    },
  },
});
