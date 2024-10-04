const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,

  devServer: {
    proxy: {
      '/nhl-api': {
        target: 'https://api-web.nhle.com/v1', // Target NHL API base URL
        changeOrigin: true,                    // Needed for virtual hosted sites
        pathRewrite: { '^/nhl-api': '' },      // Remove '/nhl-api' prefix when forwarding
        secure: false,                         // Disable SSL verification for development
        logLevel: 'debug',                     // Show debug info in terminal
      },
    },
  },
});
