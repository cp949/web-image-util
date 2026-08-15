import { describe, expect, it } from 'vitest';
import { coveredPixels, generateTilePlan } from './tiled-processor.helpers';

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
