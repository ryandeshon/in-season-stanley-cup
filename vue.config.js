const { defineConfig } = require('@vue/cli-service');
const fs = require('fs');
const path = require('path');

module.exports = defineConfig({
  transpileDependencies: true,

  devServer: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'certs/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'certs/cert.pem')),
    },
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