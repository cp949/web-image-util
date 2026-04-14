import { defineConfig } from 'vitest/config';

/**
 * 보안 테스트 전용 Vitest 설정
 *
 * 목적: SVG 입력 검증, XSS 방지, 캔버스 오염 방지 등 보안 회귀 테스트
 * 환경: happy-dom (브라우저 없는 Node.js 환경)
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/canvas-mock.ts'],
    include: ['tests/security/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
    retry: 1,
    reporters: ['verbose'],
  },
});
