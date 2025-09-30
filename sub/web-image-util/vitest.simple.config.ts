import { defineConfig } from 'vitest/config';

/**
 * 간단한 테스트 설정 (happy-dom 환경)
 * 브라우저 없이 빠르게 테스트
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: 1,
    reporter: 'verbose',
  },
});