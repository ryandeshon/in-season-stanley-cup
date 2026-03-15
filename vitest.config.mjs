import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'aws-sdk': path.resolve(__dirname, 'tests/unit/mocks/aws-sdk.js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.js'],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
