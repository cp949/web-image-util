import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'node', // Fixed to Node.js environment

    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,ts}', 'src/**/*.{test,spec}.{js,ts}'],

    // Files to exclude
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.d.ts', 'tests/browser/**'],

    // Global configuration
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },

    // Timeout configuration
    testTimeout: 30000, // 30 seconds (considering image processing time)
    hookTimeout: 10000, // 10 seconds

    // Retry configuration
    retry: 2, // Retry 2 times on failure (handling browser instability)

    // Reporter configuration
    reporters: process.env.CI ? ['junit', 'github-actions'] : ['verbose'],

    // Setup files
    setupFiles: ['./tests/setup.ts'],
  },

  // Vite configuration
  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests',
    },
  },
});
