/**
 * HighResolutionManager.smartResize 의 forceStrategy 전달 계약 테스트
 *
 * STEPPED / TILED / CHUNKED 경로는 실제 Canvas 렌더가 jsdom 에서 의미가 흔들리므로
 * SteppedProcessor / TiledProcessor 의 정적 메서드를 vi.spyOn 으로 격리하고
 * 호출 인자(치수, quality 변환, maxSteps/maxConcurrency/tileSize)를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessingStrategy } from '../../../src/base/high-res-detector';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { SteppedProcessor } from '../../../src/base/stepped-processor';
import { TiledProcessor } from '../../../src/base/tiled-processor';
import { createMockImage } from './high-res-manager-helpers';

describe('HighResolutionManager.smartResize — forceStrategy 전달 계약', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forceStrategy="stepped" 이면 SteppedProcessor.resizeWithSteps 가 올바른 치수로 호출된다', async () => {
    const stubCanvas = document.createElement('canvas');
    stubCanvas.width = 50;
    stubCanvas.height = 50;
    const steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.STEPPED,
    });

    expect(steppedSpy).toHaveBeenCalledOnce();
    expect(steppedSpy.mock.calls[0]?.[1]).toBe(50); // targetWidth
    expect(steppedSpy.mock.calls[0]?.[2]).toBe(50); // targetHeight
  });

  it('forceStrategy="stepped", quality="high" → SteppedProcessor에 quality="high", maxSteps=15 가 전달된다', async () => {
    const stubCanvas = document.createElement('canvas');
    const steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    await HighResolutionManager.smartResize(img, 50, 50, {
      quality: 'high',
      forceStrategy: ProcessingStrategy.STEPPED,
    });

    expect(steppedSpy).toHaveBeenCalledOnce();
    const opts = steppedSpy.mock.calls[0]?.[3];
    expect(opts?.quality).toBe('high');
    expect(opts?.maxSteps).toBe(15);
  });

  it('forceStrategy="stepped", quality="fast" → SteppedProcessor에 quality="fast", maxSteps=8 이 전달된다', async () => {
    const stubCanvas = document.createElement('canvas');
    const steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    await HighResolutionManager.smartResize(img, 50, 50, {
      quality: 'fast',
      forceStrategy: ProcessingStrategy.STEPPED,
    });

    expect(steppedSpy).toHaveBeenCalledOnce();
    const opts = steppedSpy.mock.calls[0]?.[3];
    expect(opts?.quality).toBe('fast');
    expect(opts?.maxSteps).toBe(8);
  });

  it('forceStrategy="stepped", quality 미지정(balanced) → SteppedProcessor에 quality="high", maxSteps=8 이 전달된다', async () => {
    const stubCanvas = document.createElement('canvas');
    const steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.STEPPED,
      // quality 미지정 → 기본값 'balanced'
    });

    expect(steppedSpy).toHaveBeenCalledOnce();
    const opts = steppedSpy.mock.calls[0]?.[3];
    expect(opts?.quality).toBe('high'); // 'balanced' !== 'fast' → 'high'로 변환
    expect(opts?.maxSteps).toBe(8); // 'balanced' !== 'high' → 8
  });

  it('forceStrategy="tiled" 이면 TiledProcessor.resizeInTiles 가 올바른 치수와 옵션으로 호출된다', async () => {
    const stubCanvas = document.createElement('canvas');
    stubCanvas.width = 50;
    stubCanvas.height = 50;
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    const result = await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.TILED,
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    expect(tiledSpy.mock.calls[0]?.[1]).toBe(50); // targetWidth
    expect(tiledSpy.mock.calls[0]?.[2]).toBe(50); // targetHeight
    const opts = tiledSpy.mock.calls[0]?.[3];
    expect(opts?.quality).toBe('high'); // 기본 quality='balanced' → 'high'로 변환
    expect(opts?.maxConcurrency).toBe(2); // 기본 quality='balanced' → 2
    expect(opts?.enableMemoryMonitoring).toBe(true); // 항상 true
    expect(result.strategy).toBe(ProcessingStrategy.TILED);
  });

  it('forceStrategy="tiled", quality="fast" → TiledProcessor에 quality="fast", maxConcurrency=4 가 전달된다', async () => {
    const stubCanvas = document.createElement('canvas');
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    await HighResolutionManager.smartResize(img, 50, 50, {
      quality: 'fast',
      forceStrategy: ProcessingStrategy.TILED,
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    const opts = tiledSpy.mock.calls[0]?.[3];
    // quality='fast' 분기: opts.quality === 'fast' → 'fast', maxConcurrency = 4
    expect(opts?.quality).toBe('fast');
    expect(opts?.maxConcurrency).toBe(4);
  });

  it('반환값 strategy 는 forceStrategy 로 지정한 전략과 일치한다', async () => {
    const stubCanvas = document.createElement('canvas');
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    const result = await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.STEPPED,
    });

    expect(result.strategy).toBe(ProcessingStrategy.STEPPED);
  });

  it('forceStrategy="chunked" 이면 TiledProcessor.resizeInTiles 가 호출된다(chunkedResize 위임)', async () => {
    const stubCanvas = document.createElement('canvas');
    stubCanvas.width = 50;
    stubCanvas.height = 50;
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.CHUNKED,
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    // tileSize = Math.min(2048, recommendedChunkSize): 300×300 기준 recommendedChunkSize=2048 → 2048
    const opts = tiledSpy.mock.calls[0]?.[3];
    expect(opts?.tileSize).toBe(2048);
    expect(opts?.maxConcurrency).toBe(2);
  });

  it('forceStrategy="chunked", quality="fast" → TiledProcessor에 quality="fast", maxConcurrency=2 가 전달된다', async () => {
    const stubCanvas = document.createElement('canvas');
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    await HighResolutionManager.smartResize(img, 50, 50, {
      quality: 'fast',
      forceStrategy: ProcessingStrategy.CHUNKED,
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    const opts = tiledSpy.mock.calls[0]?.[3];
    // chunkedResize: opts.quality === 'fast' ? 'fast' : 'high'
    expect(opts?.quality).toBe('fast');
    expect(opts?.maxConcurrency).toBe(2);
  });

  it('forceStrategy="chunked", quality="balanced"(기본) → TiledProcessor에 quality="high", maxConcurrency=2 가 전달된다', async () => {
    const stubCanvas = document.createElement('canvas');
    const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);

    const img = createMockImage(300, 300);
    await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.CHUNKED,
      // quality 미지정 → 기본값 'balanced'
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    const opts = tiledSpy.mock.calls[0]?.[3];
    // 'balanced' !== 'fast' → 'high'로 변환
    expect(opts?.quality).toBe('high');
    expect(opts?.maxConcurrency).toBe(2);
  });
});
