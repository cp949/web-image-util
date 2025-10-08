import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/advanced-index.ts',
    'src/utils/index.ts',
    'src/presets/index.ts'
  ],
  format: ['esm'],
  target: 'es2020',
  platform: 'browser', // Browser only
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  // Optimized for browser environment using Canvas API
  esbuildOptions(options) {
    options.mainFields = ['browser', 'module', 'main'];
    // Comment preservation settings
    options.legalComments = 'linked'; // License comments in separate file
    options.keepNames = true; // Preserve function/class names
  },
});
