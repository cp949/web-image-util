import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'], // ESM only - CJS 지원 중단
  target: 'es2020',
  platform: 'browser', // 브라우저 전용
  dts: true, // TypeScript 정의 파일 생성
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  // Canvas API 사용하는 브라우저 환경에 최적화
  esbuildOptions(options) {
    options.mainFields = ['browser', 'module', 'main']
  }
})