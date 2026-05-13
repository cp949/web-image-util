import { defineConfig } from 'vitest/config';

/**
 * jsdom 단위 테스트 설정.
 *
 * 실제 브라우저 렌더링이 필요한 회귀는 `vitest.browser.config.ts`에서 실행하고,
 * 그 외 단위/계약/보안 테스트는 이 설정으로 실행한다.
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
    include: ['tests/**/*.test.ts'],
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
