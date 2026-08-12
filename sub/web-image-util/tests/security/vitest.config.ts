import { defineConfig } from 'vitest/config';

/**
 * 보안 테스트 전용 Vitest 설정
 *
 * 목적: SVG 입력 검증, XSS 방지, 캔버스 오염 방지 등 보안 회귀 테스트
 * 환경: jsdom (브라우저 없는 Node.js 환경)
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    // jsdom 기본값은 외부 리소스 로드를 막아 blob/data URL 이미지 로드가 hang된다.
    // 'usable'로 두면 canvas 패키지와 함께 Image element 로드가 동작한다.
    // (vitest.jsdom.config.ts와 동일한 설정 — 없으면 Image 의존 보안 테스트가 timeout으로 실패)
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    include: ['tests/security/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: 1,
    reporters: ['verbose'],
  },
});
