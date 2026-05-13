/**
 * Node 테스트 환경 mock 진입점.
 *
 * @description happy-dom이 비워 둔 브라우저 API를 책임별 mock 모듈로 보충한다.
 *   실제 mock 구현은 `./mocks/*`에 분리되어 있으며, 이 파일은 side-effect import만 수행한다.
 *
 *   - {@link ./mocks/canvas-element} — HTMLCanvasElement, CanvasRenderingContext2D
 *   - {@link ./mocks/image-element}  — HTMLImageElement, Image
 *   - {@link ./mocks/document-globals} — document, window, DOMParser, XMLSerializer
 *   - {@link ./mocks/object-url} — URL.createObjectURL / revokeObjectURL
 *   - {@link ./mocks/file-reader} — FileReader
 *
 *   외부에서는 이 파일 경로(`./tests/setup/canvas-mock.ts`)만 setupFiles에 등록하면 된다.
 *   import 순서는 의존성(canvas/image → document-globals) 때문에 변경하지 않는다.
 */

import './mocks/canvas-element';
import './mocks/image-element';
import './mocks/document-globals';
import './mocks/object-url';
import './mocks/file-reader';

// SVG Data URL 등 특정 SVG 입력을 단순 처리하도록 표시하는 테스트 환경 플래그.
// 실제 SVG 처리 우회는 각 테스트 코드에서 이 플래그를 참조해 분기한다.
if (typeof window !== 'undefined') {
  (globalThis as any)._SVG_MOCK_MODE = true;
}
