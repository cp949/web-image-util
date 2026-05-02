import { defineConfig } from 'vitest/config';

/**
 * Node.js test configuration (happy-dom environment)
 *
 * Purpose: Fast testing without browser
 * Features: Execute isolated test files in tests folder
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/canvas-mock.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: 1,
    reporters: ['verbose'],
  },
});
