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
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'electron') {
          // A fresh CI browser can download a spelling dictionary mid-test.
          // Disable that browser-only feature; unexpected app requests still fail.
          launchOptions.preferences.webPreferences = {
            ...launchOptions.preferences.webPreferences,
            spellcheck: false,
          };
        }
        return launchOptions;
      });
      on('after:run', (results) => {
        fs.mkdirSync('cypress/results', { recursive: true });
        fs.writeFileSync(
          'cypress/results/run.json',
          JSON.stringify(results, null, 2)
        );
        if (
          !results.totalTests ||
          (config.env.requireFullSuite && results.totalTests < 32) ||
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
