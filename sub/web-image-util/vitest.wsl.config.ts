import { defineConfig } from 'vitest/config';

/**
 * WSL Environment-Specific Vitest Configuration
 *
 * @description Includes only tests that can run in WSL environment with Canvas API constraints
 * - Type system tests
 * - Pure function tests
 * - API contract tests (using mocks)
 *
 * @excludes
 * - Actual Canvas 2D rendering tests
 * - Browser-only API tests
 * - Integration tests
 */
export default defineConfig({
  test: {
    name: 'wsl-environment',
    environment: 'node', // Context7 MCP best practice: use node environment in WSL
    setupFiles: ['./tests/setup/wsl-mocks.ts'],

    include: [
      'tests/unit/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'tests/performance/**/*.test.ts',
      'tests/integration/**/*.test.ts', // Phase 3-2: Include integration tests
    ],

    exclude: [
      'tests/browser/**',
      '**/node_modules/**',
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/wsl',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        // Exclude Canvas-dependent code in WSL
        'src/core/pipeline.ts', // Actual Canvas execution part
        'src/base/canvas-*.ts', // Canvas-related utilities
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 70,
        lines: 60,
        // Higher coverage target for type-related code
      },
    },

    // WSL environment optimization
    testTimeout: 10000,
    hookTimeout: 5000,
    threads: false, // Single-threaded for stability in WSL

    // Detailed error reporting
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/wsl-results.json',
    },
  },

  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests',
    },
  },
});