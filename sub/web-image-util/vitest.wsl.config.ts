import { defineConfig } from 'vitest/config';

/**
 * WSL 환경 전용 Vitest 설정
 *
 * @description Canvas API 제약이 있는 WSL 환경에서 실행 가능한 테스트들만 포함
 * - 타입 시스템 테스트
 * - 순수 함수 테스트
 * - API 계약 테스트 (모킹 사용)
 *
 * @excludes
 * - 실제 Canvas 2D rendering 테스트
 * - 브라우저 전용 API 테스트
 * - 통합 테스트
 */
export default defineConfig({
  test: {
    name: 'wsl-environment',
    environment: 'node', // Context7 MCP 베스트 프랙티스: WSL 환경에서는 node 환경 사용
    setupFiles: ['./tests/setup/wsl-mocks.ts'],

    include: [
      'tests/unit/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'tests/performance/**/*.test.ts',
      'tests/integration/**/*.test.ts', // Phase 3-2: 통합 테스트 포함
    ],

    exclude: [
      'tests/browser/**',
      '**/node_modules/**',
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/wsl',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        // Canvas 의존적인 코드는 WSL에서 제외
        'src/core/pipeline.ts', // 실제 Canvas 실행 부분
        'src/base/canvas-*.ts', // Canvas 관련 유틸리티
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 70,
        lines: 60,
        // 타입 관련 코드는 높은 커버리지 목표
      },
    },

    // WSL 환경 최적화
    testTimeout: 10000,
    hookTimeout: 5000,
    threads: false, // WSL에서 안정성을 위해 단일 스레드

    // 상세한 에러 리포팅
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/wsl-results.json',
    },
  },

  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests',
    },
  },
});