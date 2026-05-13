import { defineConfig } from 'vitest/config';

/**
 * jsdom 단위 테스트 설정.
 *
 * 새로 추가되는 단위 테스트와 jsdom으로 옮겨진 기존 테스트의 실행 환경이다.
 * happy-dom 전용 mock(`tests/setup/canvas-mock.ts`)은 로드하지 않는다.
 * jsdom과 `canvas` 패키지가 DOM/Canvas/Image API를 표준 동작에 가깝게 제공한다.
 *
 * include는 비워둔 상태로 시작한다. 일괄 마이그레이션은 하지 않는다.
 * 파일을 jsdom으로 옮길 때 아래 두 가지를 함께 적용한다.
 *   1. 이 파일의 `include` 배열에 해당 경로를 추가한다.
 *   2. `vitest.node.config.ts`의 `exclude` 배열에 같은 경로를 추가해 중복 실행을 피한다.
 *
 * 정책은 `tests/TESTING-GUIDE.md`의 "테스트 환경 정책"을 따른다.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    // jsdom 기본값은 외부 리소스 로드를 막아 blob/data URL 이미지 로드가 hang된다.
    // 'usable'로 두면 canvas 패키지와 함께 Image element 로드가 동작한다.
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    include: [],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/browser/**'],
    passWithNoTests: true,
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: 1,
    reporters: ['verbose'],
  },
});
