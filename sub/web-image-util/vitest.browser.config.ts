import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * 실제 브라우저 Canvas/Image/Blob 동작을 확인하는 smoke test 설정이다.
 *
 * jsdom 단위 테스트가 보장하지 못하는 브라우저 출력 MIME, SVG 렌더링,
 * Blob URL 이미지 로딩 경로만 최소 범위로 검증한다.
 */
export default defineConfig({
  test: {
    include: ['tests/browser/**/*.browser.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: process.env.CI ? 1 : 0,
    reporters: ['verbose'],
  },
});
