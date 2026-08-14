/**
 * resize-strategy.internal.ts 단위 테스트
 *
 * RESIZE_STRATEGY_ADAPTERS 레지스트리 형태와 tiledAdapter의 preset 분기(light/heavy)를 검증한다.
 * 실제 픽셀 연산은 TiledProcessor.resizeInTiles를 스파이해 호출 인자만 확인한다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageAnalysis } from '../../../src/base/high-res-detector.internal';
import { getResizeStrategyAdapter, RESIZE_STRATEGY_ADAPTERS } from '../../../src/base/resize-strategy.internal';
import { TiledProcessor } from '../../../src/base/tiled-processor.internal';

function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

function makeAnalysis(overrides: Partial<ImageAnalysis> = {}): ImageAnalysis {
  return {
    width: 300,
    height: 300,
    pixelCount: 90000,
    totalPixels: 90000,
    estimatedMemoryMB: 0.34,
    strategy: 'tiled',
    maxSafeDimension: 16384,
    recommendedChunkSize: 2048,
    processingComplexity: 'medium',
    ...overrides,
  };
}

describe('RESIZE_STRATEGY_ADAPTERS 레지스트리', () => {
  it('정확히 3개 전략(direct/stepped/tiled)을 갖는다', () => {
    expect(Object.keys(RESIZE_STRATEGY_ADAPTERS).sort()).toEqual(['direct', 'stepped', 'tiled']);
  });

  it('레지스트리에 없는 키는 getResizeStrategyAdapter가 undefined를 반환한다', () => {
    expect(getResizeStrategyAdapter('chunked' as any)).toBeUndefined();
  });
});

describe('tiledAdapter — preset 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('estimatedMemoryMB<=64(light) → tileSize=recommendedChunkSize 기준, maxConcurrency=2로 호출한다', async () => {
    const stubCanvas = document.createElement('canvas');
    const spy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);
    const adapter = getResizeStrategyAdapter('tiled')!;
    const analysis = makeAnalysis({ estimatedMemoryMB: 40, recommendedChunkSize: 1500 });

    await adapter.execute({
      img: createMockImage(300, 300),
      targetWidth: 100,
      targetHeight: 100,
      quality: 'fast',
      analysis,
    });

    expect(spy).toHaveBeenCalledOnce();
    const opts = spy.mock.calls[0]?.[3];
    expect(opts?.tileSize).toBe(1500);
    expect(opts?.maxConcurrency).toBe(2);
    expect(opts?.enableMemoryMonitoring).toBe(true);
  });

  it('estimatedMemoryMB>64(heavy) → tileSize 미지정, maxConcurrency는 quality 종속으로 호출한다', async () => {
    const stubCanvas = document.createElement('canvas');
    const spy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);
    const adapter = getResizeStrategyAdapter('tiled')!;
    const analysis = makeAnalysis({ estimatedMemoryMB: 300 });

    await adapter.execute({
      img: createMockImage(9000, 9000),
      targetWidth: 1000,
      targetHeight: 1000,
      quality: 'fast',
      analysis,
    });

    expect(spy).toHaveBeenCalledOnce();
    const opts = spy.mock.calls[0]?.[3];
    expect(opts?.tileSize).toBeUndefined();
    expect(opts?.maxConcurrency).toBe(4);
    expect(opts?.enableMemoryMonitoring).toBe(true);
  });

  it('getTimeMultiplier — estimatedMemoryMB<=64면 1.0, 초과면 2.0을 반환한다', () => {
    const adapter = getResizeStrategyAdapter('tiled')!;
    expect(adapter.getTimeMultiplier(makeAnalysis({ estimatedMemoryMB: 64 }))).toBe(1.0);
    expect(adapter.getTimeMultiplier(makeAnalysis({ estimatedMemoryMB: 64.1 }))).toBe(2.0);
  });
});
