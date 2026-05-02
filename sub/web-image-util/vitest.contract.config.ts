import { defineConfig } from 'vitest/config';

/**
 * 계약 테스트 전용 Vitest 설정
 *
 * Node.js 환경에서 브라우저 API 계약을 검증한다.
 * 실제 브라우저 API 대신 mock을 사용해 API 호출 형태, 인자 검증,
 * 표준 준수 여부를 확인한다.
 */
export default defineConfig({
  test: {
    name: 'contract-tests',
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/canvas-mock.ts'],
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
