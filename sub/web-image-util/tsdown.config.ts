import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/advanced-index.ts',
    'src/utils/index.ts',
    'src/presets/index.ts',
    'src/filters/plugins/index.ts',
    'src/svg-sanitizer/index.ts',
  ],
  format: ['esm'],
  target: 'es2020',
  platform: 'browser', // 브라우저 전용
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  // Canvas API를 사용하는 브라우저 환경에 맞춘 해석 순서다.
  inputOptions: {
    resolve: {
      mainFields: ['browser', 'module', 'main'],
    },
  },
  outputOptions: {
    comments: { legal: true }, // 라이선스 주석을 번들에 보존한다.
    keepNames: true, // 함수·클래스 이름을 보존한다.
  },
});
