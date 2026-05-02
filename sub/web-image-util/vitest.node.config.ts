import { defineConfig } from 'vitest/config';

/**
 * Node.js/happy-dom 테스트 설정 (브라우저 없는 빠른 단위 테스트)
 *
 * 브라우저 전용 smoke test(tests/browser/**)는 수집하지 않는다.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/canvas-mock.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/browser/**'],
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
