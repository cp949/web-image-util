import { defineConfig } from 'vitest/config'

/**
 * Contract Test-Only Vitest Configuration
 *
 * Purpose: Verify browser API contracts in Node.js environment
 * Feature: Contract testing through mocking without actual browser APIs
 * Scope: API call patterns, parameter validation, standards compliance
 */
export default defineConfig({
  test: {
    name: 'contract-tests',
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/canvas-mock.ts'],
    include: ['tests/contract/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/integration/**',
      'tests/unit/**',
      'tests/performance/**',
    ],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: 1,
    passWithNoTests: true,
    reporter: ['verbose', 'json'],
    outputFile: {
      json: 'test-results/contract-test-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/contract',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },
})
