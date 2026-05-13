import { defineConfig } from 'vitest/config';

/**
 * 계약 테스트 전용 Vitest 설정
 *
 * jsdom 환경에서 공개 패키지 계약과 브라우저 API 호출 형태를 검증한다.
 */
export default defineConfig({
  test: {
    name: 'contract-tests',
    environment: 'jsdom',
    include: ['tests/contract/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/integration/**', 'tests/unit/**', 'tests/performance/**'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: 1,
    // 계약 테스트는 항상 존재해야 한다 — include 글롭이 비면 실패시켜
    // 설정 오류나 디렉터리 이동을 즉시 감지한다.
    passWithNoTests: false,
    reporters: ['verbose', 'json'],
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
});
