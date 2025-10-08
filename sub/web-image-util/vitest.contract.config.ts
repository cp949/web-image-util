import { defineConfig } from 'vitest/config'
import { mergeConfig, sharedConfig, testTypeConfigs } from './tests/vitest.shared.config'

/**
 * Contract Test-Only Vitest Configuration
 *
 * Purpose: Verify browser API contracts in Node.js environment
 * Feature: Contract testing through mocking without actual browser APIs
 * Scope: API call patterns, parameter validation, standards compliance
 */
export default defineConfig(
  mergeConfig(sharedConfig, {
    ...testTypeConfigs.contract,
    test: {
      ...testTypeConfigs.contract.test,

      // Contract test-specific configuration
      exclude: [
        ...sharedConfig.test?.exclude || [],
        'tests/integration/**', // Exclude integration tests (requires browser)
        'tests/unit/**', // Exclude unit tests (run separately)
        'tests/performance/**' // Exclude performance tests
      ],

      // Reporter configuration (track contract test results)
      reporter: ['verbose', 'json'],
      outputFile: {
        json: 'test-results/contract-test-results.json',
      },

      // Add HTML to coverage reporters (for detailed analysis)
      coverage: {
        ...testTypeConfigs.contract.test?.coverage,
        reporter: ['text', 'json', 'html']
      }
    }
  })
)