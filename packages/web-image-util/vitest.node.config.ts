import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node.js 환경에서 실행
    environment: 'node',

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

    // 타임아웃 설정
    testTimeout: 10000, // 10초
    hookTimeout: 5000,  // 5초

    // 리포터 설정
    reporter: ['verbose'],
  },

  // Vite 설정
  resolve: {
    alias: {
      '@': '/src',
      '@tests': '/tests'
    }
  }
})