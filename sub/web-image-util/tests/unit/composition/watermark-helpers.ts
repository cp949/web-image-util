/**
 * 워터마크 테스트 공통 fixture.
 *
 * 텍스트/이미지/SimpleWatermark 테스트가 같은 더미 이미지와 기본 스타일을 반복해서 만들지 않도록
 * 한 곳에 모아둔다. 라이브러리 동작 자체를 흉내내는 게 아니라 입력 표면만 일정하게 유지하는 용도다.
 */

import { createTestCanvas } from '../../utils/canvas-helper';

/**
 * Canvas 합성 테스트에 사용할 더미 워터마크 소스를 만든다.
 *
 * 실제로는 `HTMLCanvasElement`를 반환하지만 워터마크 API의 `HTMLImageElement` 타입으로
 * 노출한다. 워터마크 production 코드는 `.width`, `.height` 읽기와 `ctx.drawImage` 호출만
 * 수행하므로 canvas로 대체해도 런타임 동작이 동일하다.
 *
 * `new Image()`만 만들어 `src` 없이 노출하면 jsdom + canvas 패키지가 표준대로 `drawImage`를
 * "Image given has not completed loading" 으로 거부한다. canvas는 별도 로드 단계가 없어
 * happy-dom과 jsdom 양쪽에서 즉시 사용할 수 있다.
 *
 * `createTestCanvas`는 픽셀 버퍼를 한 번 채워둔다. drawImage src로 사용될 때 jsdom canvas
 * 패키지가 빈 픽셀 버퍼에서 hang하는 케이스가 있어 컬러 fill을 넣어둔다.
 */
export function createTestImage(width = 50, height = 50): HTMLImageElement {
  return createTestCanvas(width, height) as unknown as HTMLImageElement;
}

/**
 * 텍스트 워터마크 테스트의 기본 스타일.
 *
 * 케이스별로 일부 속성만 덮어써서 사용한다.
 */
export const baseStyle = {
  fontFamily: 'Arial',
  fontSize: 16,
  color: '#000000',
  opacity: 0.8,
};
