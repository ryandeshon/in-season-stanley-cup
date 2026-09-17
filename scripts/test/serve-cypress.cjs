// Process-level overrides take precedence over .env files and inherited CI values.
// This launcher is only used by browser tests, never by the production build.
const { spawn } = require('node:child_process');

const server = spawn(
  process.execPath,
  [
    require.resolve('@vue/cli-service/bin/vue-cli-service.js'),
    'serve',
    '--mode',
    'cypress',
    '--port',
    '8080',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VUE_APP_HOSTED_ARCADE_PREVIEW: 'false',
      VUE_APP_API_BASE: 'http://localhost:8080/api',
      VUE_APP_NHL_API_URL: 'http://localhost:8080/nhl',
      VUE_APP_WEB_SOCKET_URL: '',
      VUE_APP_ASSET_BASE_URL: '',
      VUE_APP_ENABLE_SEASON_CONTRACTS: 'true',
    },
  }
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
server.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
