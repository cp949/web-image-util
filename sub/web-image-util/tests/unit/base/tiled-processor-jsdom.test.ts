/**
 * TiledProcessor 단위 테스트 (jsdom + canvas 패키지 의존)
 *
 * 타일 좌표/개수, 가장자리 타일 크기, 전체 커버리지, 유효성 검사,
 * resizeInTiles / processInTiles 결과 dimension을 검증한다.
 *
 * 픽셀 비교는 최소화하고, 구조적 속성(좌표, 크기, 면적 합) 위주로 검증한다.
 *
 * jsdom + canvas 패키지의 제약:
 * - HTMLImageElement.drawImage는 src 없이 실패하므로
 *   Canvas를 HTMLImageElement 대용으로 사용한다 (node-canvas 허용).
 */

import { describe, expect, it, vi } from 'vitest';
import { TiledProcessor, type TileInfo } from '../../../src/base/tiled-processor';
import { ImageProcessError } from '../../../src/types';

// ============================================================================
// 헬퍼
// ============================================================================

/**
 * jsdom + canvas 환경에서 drawImage 소스로 사용 가능한 가짜 이미지.
 * node-canvas는 Canvas를 drawImage 소스로 수락한다.
 */
function createDrawableImage(width: number, height: number): HTMLImageElement {
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
function createMockImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

/** 타일 목록의 sourceX/sourceY/sourceWidth/sourceHeight로 커버하는 픽셀 집합 반환 */
function coveredPixels(tiles: TileInfo[]): Set<string> {
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

// ============================================================================
// validateInputs — resizeInTiles 유효성 검사
// ============================================================================

describe('TiledProcessor.resizeInTiles 유효성 검사', () => {
  it('width가 0인 이미지는 INVALID_SOURCE 에러를 던진다', async () => {
    const img = createMockImage(0, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('height가 0인 이미지는 INVALID_SOURCE 에러를 던진다', async () => {
    const img = createMockImage(100, 0);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100)).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('targetWidth가 0이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 0, 100)).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('targetHeight가 0이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 0)).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('tileSize가 0이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100, { tileSize: 0 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('overlapSize가 음수이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100, { overlapSize: -1 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('overlapSize >= tileSize이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100, { tileSize: 8, overlapSize: 8 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('maxConcurrency가 0이면 RESIZE_FAILED 에러를 던진다', async () => {
    const img = createMockImage(100, 100);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100, { maxConcurrency: 0 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
    });
  });

  it('유효성 검사 에러는 ImageProcessError 인스턴스이다', async () => {
    const img = createMockImage(0, 0);
    await expect(TiledProcessor.resizeInTiles(img, 100, 100)).rejects.toBeInstanceOf(ImageProcessError);
  });
});

// ============================================================================
// generateSimpleTilePlan — 타일 좌표/크기 (내부 메서드 직접 접근)
// ============================================================================

describe('generateSimpleTilePlan (타일 좌표/크기)', () => {
  /** 내부 private 메서드에 접근하는 헬퍼 */
  const genSimple = (w: number, h: number, tileSize: number, overlapSize: number): TileInfo[] =>
    (TiledProcessor as unknown as Record<string, (...args: unknown[]) => unknown>).generateSimpleTilePlan(
      w,
      h,
      tileSize,
      overlapSize
    ) as TileInfo[];

  it('정확히 나누어떨어지는 경우 예상 타일 개수를 반환한다', () => {
    // 16×16, tileSize=8, overlapSize=0 → 2×2 = 4 타일
    const tiles = genSimple(16, 16, 8, 0);
    expect(tiles).toHaveLength(4);
  });

  it('나누어떨어지지 않아도 올바른 타일 개수를 반환한다', () => {
    // 10×10, tileSize=8, overlapSize=0 → 2×2 = 4 타일
    const tiles = genSimple(10, 10, 8, 0);
    expect(tiles).toHaveLength(4);
  });

  it('가장자리 타일은 나머지 크기로 잘린다', () => {
    // 10×10, tileSize=8, overlapSize=0
    // 오른쪽 하단 타일: x=8, y=8, width=2, height=2
    const tiles = genSimple(10, 10, 8, 0);
    const corner = tiles.find((t) => t.sourceX === 8 && t.sourceY === 8);
    expect(corner).toBeDefined();
    expect(corner!.sourceWidth).toBe(2);
    expect(corner!.sourceHeight).toBe(2);
  });

  it('overlapSize=0이면 타일 면적의 합이 소스 면적과 같다 (겹침 없음)', () => {
    const tiles = genSimple(10, 10, 8, 0);
    const totalArea = tiles.reduce((sum, t) => sum + t.sourceWidth * t.sourceHeight, 0);
    expect(totalArea).toBe(10 * 10);
  });

  it('overlapSize=0이면 모든 소스 픽셀이 정확히 1개 타일에 포함된다', () => {
    const tiles = genSimple(16, 16, 8, 0);
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
    const tiles = genSimple(10, 10, 8, 0);
    const covered = coveredPixels(tiles);
    expect(covered.size).toBe(10 * 10);
  });

  it('overlapSize > 0이면 타일이 겹치며 총 타일 수가 증가한다', () => {
    // overlapSize=4이면 step=4, 16×16에서 4×4=16 타일
    const tilesNoOverlap = genSimple(16, 16, 8, 0);
    const tilesWithOverlap = genSimple(16, 16, 8, 4);
    expect(tilesWithOverlap.length).toBeGreaterThan(tilesNoOverlap.length);
  });

  it('단일 타일 케이스: 이미지보다 큰 tileSize는 1개 타일을 생성한다', () => {
    const tiles = genSimple(5, 5, 16, 0);
    expect(tiles).toHaveLength(1);
    expect(tiles[0].sourceWidth).toBe(5);
    expect(tiles[0].sourceHeight).toBe(5);
  });

  it('타일의 x, y, sourceX, sourceY가 일치한다 (스케일 없는 단순 분할)', () => {
    const tiles = genSimple(16, 16, 8, 0);
    for (const t of tiles) {
      expect(t.x).toBe(t.sourceX);
      expect(t.y).toBe(t.sourceY);
      expect(t.width).toBe(t.sourceWidth);
      expect(t.height).toBe(t.sourceHeight);
    }
  });
});

// ============================================================================
// generateTilePlan — 스케일 변환 타일 계획 (내부 메서드 직접 접근)
// ============================================================================

describe('generateTilePlan (스케일 변환)', () => {
  const genPlan = (sw: number, sh: number, tw: number, th: number, tileSize: number, overlapSize: number): TileInfo[] =>
    (TiledProcessor as unknown as Record<string, (...args: unknown[]) => unknown>).generateTilePlan(
      sw,
      sh,
      tw,
      th,
      tileSize,
      overlapSize
    ) as TileInfo[];

  it('소스와 대상 크기가 같으면 sourceX/targetX가 일치한다 (scale=1)', () => {
    const tiles = genPlan(16, 16, 16, 16, 8, 0);
    for (const t of tiles) {
      expect(t.x).toBe(t.sourceX);
      expect(t.y).toBe(t.sourceY);
    }
  });

  it('2배 업스케일 시 대상 좌표가 소스 좌표의 2배이다', () => {
    // 16×16 소스 → 32×32 대상, tileSize=8, overlapSize=0
    const tiles = genPlan(16, 16, 32, 32, 8, 0);
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
    const tiles = genPlan(10, 10, 20, 20, 8, 0);
    const covered = coveredPixels(tiles);
    expect(covered.size).toBe(10 * 10);
  });
});

// ============================================================================
// estimateProcessingTime
// ============================================================================

describe('TiledProcessor.estimateProcessingTime', () => {
  it('16×16 이미지에 tileSize=8, overlapSize=0이면 tileCount=4를 반환한다', () => {
    const img = createMockImage(16, 16);
    // estimateProcessingTime 내부는 overlapSize=0으로 generateTilePlan 호출
    const { tileCount } = TiledProcessor.estimateProcessingTime(img, 16, 16, 8);
    expect(tileCount).toBe(4);
  });

  it('나누어떨어지지 않는 경우에도 올바른 tileCount를 반환한다', () => {
    const img = createMockImage(10, 10);
    const { tileCount } = TiledProcessor.estimateProcessingTime(img, 10, 10, 8);
    // 10×10, step=8 → 2×2 = 4
    expect(tileCount).toBe(4);
  });

  it('estimatedSeconds는 양수이다', () => {
    const img = createMockImage(16, 16);
    const { estimatedSeconds } = TiledProcessor.estimateProcessingTime(img, 16, 16, 8);
    expect(estimatedSeconds).toBeGreaterThan(0);
  });

  it('memoryUsageMB는 0 이상의 숫자이다', () => {
    const img = createMockImage(16, 16);
    const { memoryUsageMB } = TiledProcessor.estimateProcessingTime(img, 16, 16, 8);
    expect(typeof memoryUsageMB).toBe('number');
    expect(memoryUsageMB).toBeGreaterThanOrEqual(0);
  });

  it('tileSize=256이면 memoryUsageMB가 양수이다', () => {
    // 256×256 타일 = 256*256*4 bytes = 0.25 MB (반올림 후 0.25 > 0)
    const img = createMockImage(512, 512);
    const { memoryUsageMB } = TiledProcessor.estimateProcessingTime(img, 512, 512, 256);
    expect(memoryUsageMB).toBeGreaterThan(0);
  });

  it('타일 크기가 클수록 memoryUsageMB가 커진다', () => {
    const img = createMockImage(100, 100);
    const small = TiledProcessor.estimateProcessingTime(img, 100, 100, 16);
    const large = TiledProcessor.estimateProcessingTime(img, 100, 100, 64);
    expect(large.memoryUsageMB).toBeGreaterThan(small.memoryUsageMB);
  });
});

// ============================================================================
// recommendTileSize
// ============================================================================

describe('TiledProcessor.recommendTileSize', () => {
  it('반환값이 [256, 2048] 범위 안에 있다', () => {
    // maxMemoryMB=1 → maxTileSize=512 → 클램프 불필요, 실제 계산 경로를 탄다
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 1);
    expect(size).toBeGreaterThanOrEqual(256);
    expect(size).toBeLessThanOrEqual(2048);
  });

  it('반올림(올림): log2 소수부가 0.5 초과이면 큰 2의 거듭제곱으로 올림된다', () => {
    // maxMemoryMB=0.51 → maxTileSize=365 → recommendedSize=365 (2의 거듭제곱 아님)
    // log2(365)≈8.51 → Math.round(8.51)=9 → powerOfTwo=512
    // Math.round를 Math.floor로 교체하면: floor(8.51)=8 → 256 → 이 테스트가 잡음
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 0.51);
    expect(size).toBe(512);
  });

  it('반올림(내림): log2 소수부가 0.5 미만이면 작은 2의 거듭제곱으로 내림된다', () => {
    // maxMemoryMB=1.4 → maxTileSize=605 → recommendedSize=605 (2의 거듭제곱 아님)
    // log2(605)≈9.24 → Math.round(9.24)=9 → powerOfTwo=512
    // Math.round를 Math.ceil로 교체하면: ceil(9.24)=10 → 1024 → 이 테스트가 잡음
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 1.4);
    expect(size).toBe(512);
  });

  it('maxMemoryMB가 클수록 더 큰 타일 크기를 권장한다', () => {
    // maxMemoryMB=1 → 512, maxMemoryMB=4 → 1024, 실제로 다른 값을 반환해야 한다
    const img = createMockImage(4000, 3000);
    const small = TiledProcessor.recommendTileSize(img, 1);
    const large = TiledProcessor.recommendTileSize(img, 4);
    expect(large).toBeGreaterThan(small); // 등호 없이: 단조성을 실제로 검증
  });

  it('minSize 클램프: 매우 작은 maxMemoryMB는 256을 반환한다', () => {
    // maxMemoryMB=0.1 → maxTileSize=161 → minSize 클램프 → 256
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 0.1);
    expect(size).toBe(256);
  });

  it('maxSize 클램프: 큰 maxMemoryMB는 2048을 반환한다', () => {
    // maxMemoryMB=64 → maxTileSize=4096 → maxSize 클램프(2048) 발동 → 2048
    // Math.min(2048, maxTileSize) 분기를 실제로 행사함
    const img = createMockImage(4000, 3000);
    const size = TiledProcessor.recommendTileSize(img, 64);
    expect(size).toBe(2048);
  });
});

// ============================================================================
// assessTiledProcessingSuitability
// ============================================================================

describe('TiledProcessor.assessTiledProcessingSuitability', () => {
  it('4MP 미만 이미지는 suitable=false를 반환한다', () => {
    // 1000×1000 = ~0.95MP < 4MP, tileSize=256 → 16 타일(충분)
    // megaPixels 조건만 false를 만들기 위해 타일 수는 충분하게 설정
    const img = createMockImage(1000, 1000);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 256);
    expect(result.suitable).toBe(false);
  });

  it('megaPixels >= 4이고 타일 수 >= 4이면 suitable=true를 반환한다', () => {
    // 2048×2048 = 4MP, tileSize=1024 → 2×2 = 4 타일: 두 조건 모두 통과
    const img = createMockImage(2048, 2048);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 1024);
    expect(result.suitable).toBe(true);
    expect(result.reasons).toContain('Suitable for tile-based processing.');
  });

  it('suitable=false이면 reasons에 설명이 포함된다', () => {
    const img = createMockImage(100, 100);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 1024);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('estimatedTiles는 실제 타일 수와 일치한다', () => {
    // 16×16 이미지, tileSize=8, overlapSize=0 → 4 타일
    const img = createMockImage(16, 16);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 8);
    expect(result.estimatedTiles).toBe(4);
  });

  it('estimatedMemoryMB는 양수이다', () => {
    const img = createMockImage(100, 100);
    const result = TiledProcessor.assessTiledProcessingSuitability(img, 64);
    expect(result.estimatedMemoryMB).toBeGreaterThan(0);
  });
});

// ============================================================================
// resizeInTiles — 결과 dimension 및 진행 콜백
// ============================================================================

describe('TiledProcessor.resizeInTiles', () => {
  it('대상 크기의 캔버스를 반환한다', async () => {
    const img = createDrawableImage(16, 16);
    const result = await TiledProcessor.resizeInTiles(img, 32, 24, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
    });
    expect(result.width).toBe(32);
    expect(result.height).toBe(24);
  });

  it('소스와 같은 크기로도 동작한다', async () => {
    const img = createDrawableImage(8, 8);
    const result = await TiledProcessor.resizeInTiles(img, 8, 8, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
    });
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  it('onProgress 콜백이 호출된다', async () => {
    const img = createDrawableImage(16, 16);
    const progressCalls: [number, number][] = [];

    await TiledProcessor.resizeInTiles(img, 16, 16, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
      onProgress: (completed, total) => progressCalls.push([completed, total]),
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    // 마지막 콜백에서 completed === total이어야 한다
    const last = progressCalls[progressCalls.length - 1];
    expect(last[0]).toBe(last[1]);
  });

  it('16×16 이미지를 tileSize=8로 처리하면 4번의 진행 콜백이 발생한다', async () => {
    const img = createDrawableImage(16, 16);
    let callCount = 0;

    await TiledProcessor.resizeInTiles(img, 16, 16, {
      tileSize: 8,
      overlapSize: 0,
      maxConcurrency: 1,
      enableMemoryMonitoring: false,
      onProgress: () => callCount++,
    });

    expect(callCount).toBe(4);
  });

  it('quality=fast 옵션도 올바른 크기의 캔버스를 반환한다', async () => {
    const img = createDrawableImage(8, 8);
    const result = await TiledProcessor.resizeInTiles(img, 16, 16, {
      tileSize: 8,
      overlapSize: 0,
      quality: 'fast',
      enableMemoryMonitoring: false,
    });
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
  });
});

// ============================================================================
// processInTiles — 결과 dimension
// ============================================================================

describe('TiledProcessor.processInTiles', () => {
  it('소스 이미지 크기의 캔버스를 반환한다', async () => {
    const img = createDrawableImage(16, 16);
    const result = await TiledProcessor.processInTiles(
      img,
      (tileCanvas) => tileCanvas, // no-op: 타일을 그대로 반환
      { tileSize: 8, overlapSize: 0, enableMemoryMonitoring: false }
    );
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
  });

  it('onProgress 콜백이 타일 수만큼 호출된다', async () => {
    const img = createDrawableImage(16, 16);
    const progressCalls: [number, number][] = [];

    await TiledProcessor.processInTiles(img, (tileCanvas) => tileCanvas, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
      onProgress: (completed, total) => progressCalls.push([completed, total]),
    });

    // 16×16, tileSize=8, overlapSize=0 → 4 타일
    expect(progressCalls).toHaveLength(4);
    expect(progressCalls[progressCalls.length - 1]).toEqual([4, 4]);
  });

  it('비동기 프로세서도 지원한다', async () => {
    const img = createDrawableImage(8, 8);
    const result = await TiledProcessor.processInTiles(
      img,
      async (tileCanvas) => {
        await Promise.resolve();
        return tileCanvas;
      },
      { tileSize: 8, overlapSize: 0, enableMemoryMonitoring: false }
    );
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  it('processor가 타일 수만큼 (HTMLCanvasElement, TileInfo) 인자로 호출된다', async () => {
    // 16×16, tileSize=8, overlapSize=0 → 4 타일
    const img = createDrawableImage(16, 16);
    const mockProcessor = vi.fn((tileCanvas: HTMLCanvasElement, _tileInfo: TileInfo) => tileCanvas);

    await TiledProcessor.processInTiles(img, mockProcessor, {
      tileSize: 8,
      overlapSize: 0,
      enableMemoryMonitoring: false,
    });

    // 호출 횟수가 타일 수와 일치해야 한다
    expect(mockProcessor).toHaveBeenCalledTimes(4);

    // 각 호출의 첫 번째 인자가 HTMLCanvasElement이어야 한다
    for (const [tileCanvas] of mockProcessor.mock.calls) {
      expect(tileCanvas).toBeInstanceOf(HTMLCanvasElement);
    }

    // 두 번째 인자(TileInfo)의 좌표가 기대 타일 좌표와 일치해야 한다
    const tileInfos = mockProcessor.mock.calls.map((call) => call[1] as TileInfo);
    expect(tileInfos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceX: 0, sourceY: 0, sourceWidth: 8, sourceHeight: 8 }),
        expect.objectContaining({ sourceX: 8, sourceY: 0, sourceWidth: 8, sourceHeight: 8 }),
        expect.objectContaining({ sourceX: 0, sourceY: 8, sourceWidth: 8, sourceHeight: 8 }),
        expect.objectContaining({ sourceX: 8, sourceY: 8, sourceWidth: 8, sourceHeight: 8 }),
      ])
    );
  });
});

// ============================================================================
// 픽셀 검증은 jsdom + canvas 환경에서 drawImage(fake-img) 신뢰도가 낮으므로
// 제외한다. 경계 결함 검증은 브라우저 스모크 테스트 범위로 기록한다.
// ============================================================================
