import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/utils/index.ts',
    'src/presets/index.ts'
  ],
  format: ['esm'],
  target: 'es2020',
  platform: 'browser', // 브라우저 전용
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  // Canvas API 사용하는 브라우저 환경에 최적화
  esbuildOptions(options) {
    options.mainFields = ['browser', 'module', 'main'];
  },
});
