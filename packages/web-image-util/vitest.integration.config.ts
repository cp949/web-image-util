import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Playwright Browser Mode 사용 (실제 브라우저 환경)
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [
        {
          browser: 'chromium',
          name: 'chromium',
        }
      ],
      ui: false,
      isolate: true,
      fileParallelism: false, // 통합 테스트는 순차 실행
      connectTimeout: 30000,
    },

    // 통합 테스트 파일만 포함
    include: [
      'tests/integration/**/*.test.ts',
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

    // 통합 테스트용 셋업 파일 (브라우저 환경용)
    setupFiles: ['./tests/setup/browser-integration-setup.ts'],

    // 커버리지 설정
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'src/processor.ts',
        'src/core/**/*.ts',
        'src/index.ts'
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
        'src/base/errors.ts'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },

    // 타임아웃 설정 (브라우저 환경 및 Canvas 처리 시간 고려)
    testTimeout: 15000,
    hookTimeout: 10000,

    // 재시도 설정 (브라우저 불안정성 대응)
    retry: 1,

    // 리포터 설정
    reporter: 'verbose',

    // 단일 스레드 실행 (Canvas 안정성을 위해)
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },

  // Vite 설정
  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests'
    }
  }
})