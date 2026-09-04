import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = resolve(here, 'fixtures');

// Chrome83(Podman) floor validation 전용 build 설정이다. vite dev server(esbuild
// 즉석 트랜스파일, build.target 미적용)로 fixtures를 서빙하면 tsdown.config.ts의
// target: 'chrome75' 다운레벨이 검증 대상에서 빠진다. 그래서 virtual-dist.ts
// (dist/index.js를 직접 import)만 production build로 한 번 더 내려받아
// preview로 정적 서빙한다. build.target을 tsdown과 동일한 'chrome75'로 맞춰
// fixture 번들 코드도 dist와 같은 하한을 보장한다.
export default defineConfig({
  root: fixturesRoot,
  build: {
    target: 'chrome75',
    outDir: resolve(here, 'chrome83-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'virtual-dist': resolve(fixturesRoot, 'virtual-dist.html'),
      },
    },
  },
});
