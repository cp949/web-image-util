import { defineConfig } from 'vitest/config';

/**
 * 루트 운영 스크립트 전용 테스트 설정
 *
 * 패키지 내부 테스트와 분리해 모노레포 루트의 배포/검증 스크립트 계약을 검증한다.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: 1,
    reporters: ['verbose'],
  },
});
