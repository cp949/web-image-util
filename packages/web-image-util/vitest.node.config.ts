import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node.js 환경에서 실행
    environment: 'node',

    // Node.js 환경에서 실행할 순수 로직 테스트들만 포함
    include: [
      'tests/unit/*-pure.test.ts',
      'tests/unit/svg-compatibility.test.ts', // SVG 호환성 테스트
      'tests/unit/binary-support.test.ts', // ArrayBuffer/Uint8Array 지원 테스트
      'tests/unit/file-support.test.ts', // File 객체 생성 테스트
      'tests/unit/svg-support.test.ts', // SVG 특별 처리 테스트
      'tests/calculations.test.ts',
      'tests/errors.test.ts',
      'tests/error-helpers.test.ts',
      'tests/contract/**/*.test.ts', // 계약 테스트 포함
      'tests/performance/**/*.test.ts', // Canvas Pool 성능 테스트 포함
      'tests/integration/integration.test.ts', // 통합 테스트
    ],

    // 제외할 파일들
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts',
    ],

    // 글로벌 설정
    globals: true,

    // 셋업 파일 (계약 테스트용 모킹 포함)
    setupFiles: ['tests/contract/setup/contract-mocks.ts'],

    // 커버리지 설정
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts'
      ],
    },

    // 타임아웃 설정 (Node.js는 빠름)
    testTimeout: 5000,
    hookTimeout: 3000,

    // 재시도 설정 (Node.js는 안정적)
    retry: 0,

    // 리포터 설정
    reporter: 'verbose',
  },

  // Vite 설정
  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests'
    }
  }
})