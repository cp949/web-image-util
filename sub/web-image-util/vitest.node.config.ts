import { defineConfig } from 'vitest/config';
import { mergeConfig, sharedConfig } from './tests/vitest.shared.config';

/**
 * Node.js 테스트 설정
 *
 * 목적: 순수 로직, 계약 테스트, 통합 테스트, 성능 테스트 통합 실행
 * 특징: 모든 Node.js 환경 테스트를 하나의 명령으로 실행
 */
export default defineConfig(
  mergeConfig(sharedConfig, {
    test: {
      // Node.js 환경에서 실행
      environment: 'node',

      // 모든 Node.js 호환 테스트 포함
      include: [
        // 단위 테스트 (순수 로직)
        'tests/unit/**/*.test.ts',

        // 계약 테스트 (브라우저 API 모킹)
        'tests/contract/**/*.test.ts',

        // 통합 테스트
        'tests/integration/**/*.test.ts',

        // 성능 테스트
        'tests/performance/**/*.test.ts',

        // 레거시 테스트 파일들 (호환성 유지)
        'tests/calculations.test.ts',
        'tests/errors.test.ts',
        'tests/error-helpers.test.ts',
      ],

      // 셋업 파일 (브라우저 API 모킹 포함)
      setupFiles: ['tests/contract/setup/contract-mocks.ts'],

      // 통합 커버리지 설정
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json'],
        reportsDirectory: 'coverage/all',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
        // 전체 테스트의 종합 커버리지 기준
        thresholds: {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
      },

      // Node.js 환경 최적화 타임아웃
      testTimeout: 15000, // 통합/성능 테스트를 고려한 여유로운 설정
      hookTimeout: 8000,

      // 안정성을 위한 재시도 설정
      retry: 1,

      // 상세한 리포터 (모든 테스트 타입 결과 표시)
      reporter: 'verbose',

      // 테스트 순서 최적화 (빠른 테스트부터)
      sequence: {
        shuffle: false, // 일관된 실행 순서 유지
        concurrent: true, // 가능한 테스트는 병렬 실행
      },
    },
  })
);
