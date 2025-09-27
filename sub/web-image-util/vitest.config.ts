import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Browser Mode 설정
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [
        {
          browser: 'chromium',
          name: 'chromium',
        },
        {
          browser: 'firefox',
          name: 'firefox',
        },
        {
          browser: 'webkit',
          name: 'webkit',
        },
      ],
      // 브라우저 테스트 UI 설정
      ui: false, // CI에서는 비활성화
      // 파일별 격리
      isolate: true,
      // 병렬 실행
      fileParallelism: true,
      // 연결 타임아웃
      connectTimeout: 60000,
    },

    // 테스트 환경 설정
    environment: 'happy-dom', // 비브라우저 테스트용

    // 테스트 파일 패턴
    include: [
      'tests/**/*.{test,spec}.{js,ts}',
      'src/**/*.{test,spec}.{js,ts}'
    ],

    // 제외할 파일들
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts'
    ],

    // 글로벌 설정
    globals: true,

    // 커버리지 설정
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },

    // 타임아웃 설정
    testTimeout: 30000, // 30초 (이미지 처리 시간 고려)
    hookTimeout: 10000, // 10초

    // 재시도 설정
    retry: 2, // 실패시 2번 재시도 (브라우저 불안정성 대응)

    // 리포터 설정
    reporter: process.env.CI ? ['junit', 'github-actions'] : ['verbose'],

    // 셋업 파일
    setupFiles: ['./tests/setup.ts'],
  },

  // Vite 설정
  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests'
    }
  }
})