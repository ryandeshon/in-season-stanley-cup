import { defineConfig } from '@vue/cli-service';
import webpack from 'webpack';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

export default defineConfig({
  transpileDependencies: true,
  chainWebpack(config) {
    // Keep secondary routes from competing with game data on mobile startup.
    config.plugins.delete('prefetch');
  },
  configureWebpack: {
    plugins: [
      new webpack.DefinePlugin({
        'process.env.VUE_APP_VERSION': JSON.stringify(version),
      }),
    ],
  },
});
