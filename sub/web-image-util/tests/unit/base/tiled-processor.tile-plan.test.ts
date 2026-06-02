import { describe, expect, it } from 'vitest';
import { coveredPixels, generateSimpleTilePlan, generateTilePlan } from './tiled-processor.helpers';

describe('generateSimpleTilePlan (타일 좌표/크기)', () => {
  it('정확히 나누어떨어지는 경우 예상 타일 개수를 반환한다', () => {
    // 16×16, tileSize=8, overlapSize=0 → 2×2 = 4 타일
    const tiles = generateSimpleTilePlan(16, 16, 8, 0);
    expect(tiles).toHaveLength(4);
  });

  it('나누어떨어지지 않아도 올바른 타일 개수를 반환한다', () => {
    // 10×10, tileSize=8, overlapSize=0 → 2×2 = 4 타일
    const tiles = generateSimpleTilePlan(10, 10, 8, 0);
    expect(tiles).toHaveLength(4);
  });

  it('가장자리 타일은 나머지 크기로 잘린다', () => {
    // 10×10, tileSize=8, overlapSize=0
    // 오른쪽 하단 타일: x=8, y=8, width=2, height=2
    const tiles = generateSimpleTilePlan(10, 10, 8, 0);
    const corner = tiles.find((t) => t.sourceX === 8 && t.sourceY === 8);
    expect(corner).toBeDefined();
    expect(corner!.sourceWidth).toBe(2);
    expect(corner!.sourceHeight).toBe(2);
  });

  it('overlapSize=0이면 타일 면적의 합이 소스 면적과 같다 (겹침 없음)', () => {
    const tiles = generateSimpleTilePlan(10, 10, 8, 0);
    const totalArea = tiles.reduce((sum, t) => sum + t.sourceWidth * t.sourceHeight, 0);
    expect(totalArea).toBe(10 * 10);
  });

  it('overlapSize=0이면 모든 소스 픽셀이 정확히 1개 타일에 포함된다', () => {
    const tiles = generateSimpleTilePlan(16, 16, 8, 0);
    const pixelCount = new Map<string, number>();
    for (const t of tiles) {
      for (let y = t.sourceY; y < t.sourceY + t.sourceHeight; y++) {
        for (let x = t.sourceX; x < t.sourceX + t.sourceWidth; x++) {
          const key = `${x},${y}`;
          pixelCount.set(key, (pixelCount.get(key) ?? 0) + 1);
        }
      }
    }
    for (const count of pixelCount.values()) {
      expect(count).toBe(1);
    }
  });

  it('overlapSize=0이면 모든 소스 픽셀이 최소 1개 타일에 포함된다 (완전 커버리지)', () => {
    const tiles = generateSimpleTilePlan(10, 10, 8, 0);
    const covered = coveredPixels(tiles);
    expect(covered.size).toBe(10 * 10);
  });

  it('overlapSize > 0이면 타일이 겹치며 총 타일 수가 증가한다', () => {
    // overlapSize=4이면 step=4, 16×16에서 4×4=16 타일
    const tilesNoOverlap = generateSimpleTilePlan(16, 16, 8, 0);
    const tilesWithOverlap = generateSimpleTilePlan(16, 16, 8, 4);
    expect(tilesWithOverlap.length).toBeGreaterThan(tilesNoOverlap.length);
  });

  it('단일 타일 케이스: 이미지보다 큰 tileSize는 1개 타일을 생성한다', () => {
    const tiles = generateSimpleTilePlan(5, 5, 16, 0);
    expect(tiles).toHaveLength(1);
    expect(tiles[0].sourceWidth).toBe(5);
    expect(tiles[0].sourceHeight).toBe(5);
  });

  it('타일의 x, y, sourceX, sourceY가 일치한다 (스케일 없는 단순 분할)', () => {
    const tiles = generateSimpleTilePlan(16, 16, 8, 0);
    for (const t of tiles) {
      expect(t.x).toBe(t.sourceX);
      expect(t.y).toBe(t.sourceY);
      expect(t.width).toBe(t.sourceWidth);
      expect(t.height).toBe(t.sourceHeight);
    }
  });
});

describe('generateTilePlan (스케일 변환)', () => {
  it('소스와 대상 크기가 같으면 sourceX/targetX가 일치한다 (scale=1)', () => {
    const tiles = generateTilePlan(16, 16, 16, 16, 8, 0);
    for (const t of tiles) {
      expect(t.x).toBe(t.sourceX);
      expect(t.y).toBe(t.sourceY);
    }
  });

  it('2배 업스케일 시 대상 좌표가 소스 좌표의 2배이다', () => {
    // 16×16 소스 → 32×32 대상, tileSize=8, overlapSize=0
    const tiles = generateTilePlan(16, 16, 32, 32, 8, 0);
    expect(tiles.length).toBeGreaterThan(0);
    // 첫 번째 타일: sourceX=0 → targetX=0
    expect(tiles[0].x).toBe(0);
    expect(tiles[0].y).toBe(0);
    // 두 번째 타일 (x 방향): sourceX=8 → targetX = Math.floor(8 * 2) = 16
    const secondX = tiles.find((t) => t.sourceX === 8 && t.sourceY === 0);
    expect(secondX).toBeDefined();
    expect(secondX!.x).toBe(16);
  });

  it('overlapSize=0이면 모든 소스 픽셀이 커버된다', () => {
    const tiles = generateTilePlan(10, 10, 20, 20, 8, 0);
    const covered = coveredPixels(tiles);
    expect(covered.size).toBe(10 * 10);
  });
});
