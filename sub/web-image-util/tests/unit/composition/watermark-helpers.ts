/**
 * 워터마크 테스트 공통 fixture.
 *
 * 텍스트/이미지/SimpleWatermark 테스트가 같은 더미 이미지와 기본 스타일을 반복해서 만들지 않도록
 * 한 곳에 모아둔다. 라이브러리 동작 자체를 흉내내는 게 아니라 입력 표면만 일정하게 유지하는 용도다.
 */

/**
 * Canvas 합성 테스트에 사용할 더미 HTMLImageElement를 만든다.
 *
 * width/height만 의미가 있고 실제 픽셀 데이터는 사용하지 않는다.
 */
export function createTestImage(width = 50, height = 50): HTMLImageElement {
  const img = new Image();
  img.width = width;
  img.height = height;
  return img as HTMLImageElement;
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
