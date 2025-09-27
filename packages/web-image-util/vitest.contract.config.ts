import { defineConfig } from 'vitest/config'

/**
 * 계약 테스트 전용 Vitest 설정
 *
 * 목적: Node.js 환경에서 브라우저 API 계약 검증
 * 특징: 실제 브라우저 API 없이 모킹을 통한 계약 테스트
 * 범위: API 호출 패턴, 매개변수 검증, 표준 준수
 */
export default defineConfig({
  test: {
    // Node.js 환경에서 실행 (브라우저 API 모킹 사용)
    environment: 'node',

    // 계약 테스트 파일들만 포함
    include: [
      'tests/contract/**/*.test.ts',
    ],

    // 브라우저 의존 테스트 제외
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts',
      'tests/integration/**', // 통합 테스트 제외 (브라우저 필요)
      'tests/unit/**', // 단위 테스트 제외 (별도 실행)
    ],

    // 글로벌 설정
    globals: true,

    // 셋업 파일 (브라우저 API 모킹)
    setupFiles: ['tests/contract/setup/contract-mocks.ts'],

    // 커버리지 설정 (계약 테스트용)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/contract',
      include: [
        'src/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ],
      // 계약 테스트는 호출 패턴 검증이 목적이므로 낮은 커버리지도 허용
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50,
      },
    },

    // 테스트 타임아웃 설정 (Node.js 환경이므로 짧게)
    testTimeout: 10000, // 10초
    hookTimeout: 5000,  // 5초

    // 재시도 설정 (계약 테스트는 안정적이어야 함)
    retry: 1,

    // 리포터 설정
    reporter: ['verbose', 'json'],
    outputFile: {
      json: 'test-results/contract-test-results.json',
    },

    // 병렬 실행 설정 (Node.js에서 빠른 실행)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
      },
    },

    // 모킹 설정
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // 테스트 환경 변수
    env: {
      NODE_ENV: 'test',
      TEST_TYPE: 'contract',
    },
  },

  // Vite 설정
  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests',
      '@contract': '/tests/contract',
    }
  },

  // esbuild 설정 (빠른 컴파일)
  esbuild: {
    target: 'node18',
    format: 'esm',
  },
});