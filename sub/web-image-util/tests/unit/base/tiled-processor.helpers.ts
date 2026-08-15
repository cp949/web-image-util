import { TiledProcessor, type TileInfo } from '../../../src/base/tiled-processor.internal';

type TiledProcessorPrivate = Record<string, (...args: unknown[]) => unknown>;

/**
 * jsdom + canvas 환경에서 drawImage 소스로 사용 가능한 가짜 이미지.
 * node-canvas는 Canvas를 drawImage 소스로 수락한다.
 */
export function createDrawableImage(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3399ff';
  ctx.fillRect(0, 0, width, height);
  return canvas as unknown as HTMLImageElement;
}

/**
 * 유효성 검사를 통과하는 최소 mock 이미지.
 * drawImage 호출이 없는 경로(예: 에러 검사)에서 사용한다.
 */
export function createMockImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

/** 타일 목록의 sourceX/sourceY/sourceWidth/sourceHeight로 커버하는 픽셀 집합 반환 */
export function coveredPixels(tiles: TileInfo[]): Set<string> {
  const set = new Set<string>();
  for (const t of tiles) {
    for (let y = t.sourceY; y < t.sourceY + t.sourceHeight; y++) {
      for (let x = t.sourceX; x < t.sourceX + t.sourceWidth; x++) {
        set.add(`${x},${y}`);
      }
    }
  }
  return set;
}

/** 내부 private 메서드에 접근하는 테스트 헬퍼 */
export function generateTilePlan(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  tileSize: number,
  overlapSize: number
): TileInfo[] {
  return (TiledProcessor as unknown as TiledProcessorPrivate).generateTilePlan(
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    tileSize,
    overlapSize
  ) as TileInfo[];
}
