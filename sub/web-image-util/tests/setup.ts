/**
 * Vitest Node 테스트 setup 파일이다.
 *
 * happy-dom이 제공하지 않는 Canvas/Image/FileReader 계층은
 * `tests/setup/canvas-mock.ts`에서 최소 mock으로 보완한다.
 * 실제 렌더링, 픽셀, MIME fallback 검증은 `tests/browser/**`에서 맡는다.
 */

import './setup/canvas-mock';
