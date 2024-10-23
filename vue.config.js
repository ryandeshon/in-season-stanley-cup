const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,

  devServer: {
    proxy: {
      '/nhl-api': {
        target: process.env.VUE_APP_NHL_API_URL, // Target NHL API base URL
        changeOrigin: true,                      // Needed for virtual hosted sites
        pathRewrite: { '^/nhl-api': '' },        // Remove '/nhl-api' prefix when forwarding
        secure: process.env.NODE_ENV !== 'development', // Disable SSL verification only for development
        logLevel: 'debug',                       // Show debug info in terminal
      },
    },
  },
});
