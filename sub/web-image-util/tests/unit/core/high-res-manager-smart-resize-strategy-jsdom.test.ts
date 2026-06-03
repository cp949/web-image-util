/**
 * HighResolutionManager.smartResize 의 forceStrategy 전달 계약 테스트
 *
 * STEPPED / TILED / CHUNKED 경로는 실제 Canvas 렌더가 jsdom 에서 의미가 흔들리므로
 * SteppedProcessor / TiledProcessor 의 정적 메서드를 vi.spyOn 으로 격리하고
 * 호출 인자(치수, quality 변환, maxSteps/maxConcurrency/tileSize)를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessingStrategy } from '../../../src/base/high-res-detector.internal';
import { HighResolutionManager, type HighResolutionProgress } from '../../../src/base/high-res-manager';
import { SteppedProcessor } from '../../../src/base/stepped-processor.internal';
import { TiledProcessor } from '../../../src/base/tiled-processor.internal';
import { createMockImage, makeProcessingResult } from './high-res-manager-helpers';

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

describe('HighResolutionManager.smartResize — enableProgressTracking 진행률 shape', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enableProgressTracking=true 이면 onProgress 가 한 번 이상 호출된다', async () => {
    const stubCanvas = document.createElement('canvas');
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const progressCalls: HighResolutionProgress[] = [];
    const img = createMockImage(300, 300);

    await HighResolutionManager.smartResize(img, 50, 50, {
      enableProgressTracking: true,
      forceStrategy: ProcessingStrategy.STEPPED,
      onProgress: (p) => progressCalls.push(p),
    });

    expect(progressCalls.length).toBeGreaterThan(0);
  });

  it('onProgress 의 각 호출은 stage/progress/timeElapsed/estimatedTimeRemaining/memoryUsageMB/currentStrategy 를 갖는다', async () => {
    const stubCanvas = document.createElement('canvas');
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const progressCalls: HighResolutionProgress[] = [];
    const img = createMockImage(300, 300);

    await HighResolutionManager.smartResize(img, 50, 50, {
      enableProgressTracking: true,
      forceStrategy: ProcessingStrategy.STEPPED,
      onProgress: (p) => progressCalls.push(p),
    });

    const validStages = ['analyzing', 'processing', 'finalizing', 'completed'];
    for (const p of progressCalls) {
      expect(validStages).toContain(p.stage);
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThanOrEqual(100);
      expect(typeof p.timeElapsed).toBe('number');
      expect(typeof p.estimatedTimeRemaining).toBe('number');
      expect(typeof p.memoryUsageMB).toBe('number');
      expect(Object.values(ProcessingStrategy)).toContain(p.currentStrategy);
    }
  });

  it('마지막 onProgress 호출은 stage="completed", progress=100 이다', async () => {
    const stubCanvas = document.createElement('canvas');
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const progressCalls: HighResolutionProgress[] = [];
    const img = createMockImage(300, 300);

    await HighResolutionManager.smartResize(img, 50, 50, {
      enableProgressTracking: true,
      forceStrategy: ProcessingStrategy.STEPPED,
      onProgress: (p) => progressCalls.push(p),
    });

    const last = progressCalls[progressCalls.length - 1];
    expect(last?.stage).toBe('completed');
    expect(last?.progress).toBe(100);
  });

  it('enableProgressTracking=false(기본값) 이면 onProgress 가 호출되지 않는다', async () => {
    const stubCanvas = document.createElement('canvas');
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const onProgress = vi.fn();
    const img = createMockImage(300, 300);

    await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.STEPPED,
      onProgress,
    });

    expect(onProgress).not.toHaveBeenCalled();
  });

  it('진행률 시퀀스는 "analyzing" 으로 시작하고 "processing" 단계가 최소 1회 포함된다', async () => {
    const stubCanvas = document.createElement('canvas');
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

    const progressCalls: HighResolutionProgress[] = [];
    const img = createMockImage(300, 300);

    await HighResolutionManager.smartResize(img, 50, 50, {
      enableProgressTracking: true,
      forceStrategy: ProcessingStrategy.STEPPED,
      onProgress: (p) => progressCalls.push(p),
    });

    // 첫 콜백은 반드시 analyzing 단계여야 한다
    expect(progressCalls[0]?.stage).toBe('analyzing');
    // 시퀀스에 processing 단계가 최소 1회 포함되어야 한다
    expect(progressCalls.some((p) => p.stage === 'processing')).toBe(true);
  });
});

describe('HighResolutionManager.batchSmartResize — 결과 순서/실패 전파/진행률', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('입력 이미지 순서대로 결과를 반환한다', async () => {
    // smartResize를 mock해 각 이미지마다 고유한 크기의 canvas를 담은 결과를 반환한다
    const sizes = [10, 20, 30, 40, 50];
    const images = sizes.map((s) => createMockImage(s, s));

    vi.spyOn(HighResolutionManager, 'smartResize').mockImplementation(async (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      return makeProcessingResult({ canvas }) as any;
    });

    // concurrency=2 → 청크 [[10,20],[30,40],[50]], 결과는 전역 index 순서를 보존
    const results = await HighResolutionManager.batchSmartResize(images, 100, 100, { concurrency: 2 });

    expect(results).toHaveLength(5);
    expect(results.map((r) => r.canvas.width)).toEqual(sizes);
  });

  it('특정 index 작업이 실패하면 Batch processing stage와 index context를 보존한다', async () => {
    const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(300, 300)];

    vi.spyOn(HighResolutionManager, 'smartResize').mockImplementation(async (img: HTMLImageElement) => {
      if (img.width === 200) {
        throw new Error('index 1 실패');
      }
      return makeProcessingResult() as any;
    });

    // concurrency=3 → 한 청크에서 병렬 처리되고 index 1이 실패한다
    await expect(HighResolutionManager.batchSmartResize(images, 50, 50, { concurrency: 3 })).rejects.toMatchObject({
      code: 'RESIZE_FAILED',
      context: { debug: { stage: 'Batch processing', index: 1 } },
      cause: expect.objectContaining({ message: 'index 1 실패' }),
    });
  });

  it('onBatchProgress가 완료 건수와 전체 건수를 보고하고 마지막에 전부 완료를 알린다', async () => {
    const images = [createMockImage(10, 10), createMockImage(20, 20), createMockImage(30, 30)];
    vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult() as any);

    const progress: Array<[number, number]> = [];
    await HighResolutionManager.batchSmartResize(images, 50, 50, {
      concurrency: 2,
      onBatchProgress: (completed, total) => progress.push([completed, total]),
    });

    expect(progress).toHaveLength(3);
    expect(progress[progress.length - 1]).toEqual([3, 3]);
  });
});

describe('HighResolutionManager — getEstimatedUsage performance.memory 유무에 따른 안전값', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('performance.memory 없을 때 memoryPeakUsageMB 는 fallback 상수(64MB)에 근접한 값이다', async () => {
    // memory 속성이 없는 performance 를 명시적으로 주입해 fallback 분기 진입을 보장한다
    vi.stubGlobal('performance', { now: () => 0 });

    const stubCanvas = document.createElement('canvas');
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);
    const img = createMockImage(300, 300);

    const result = await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.STEPPED,
    });

    // getEstimatedUsage fallback: used=64MB → getCurrentMemoryUsage()=64
    expect(result.memoryPeakUsageMB).toBeCloseTo(64, 0);
  });

  it('performance.memory 존재 시 memoryPeakUsageMB 는 stubbed usedJSHeapSize 를 반영한다', async () => {
    // performance.memory 는 비표준 — vi.stubGlobal 로 주입하고 afterEach 에서 복구한다
    const fakeMemory = {
      usedJSHeapSize: 128 * 1024 * 1024,
      jsHeapSizeLimit: 512 * 1024 * 1024,
      totalJSHeapSize: 256 * 1024 * 1024,
    };
    vi.stubGlobal('performance', { ...globalThis.performance, memory: fakeMemory });

    const stubCanvas = document.createElement('canvas');
    vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);
    const img = createMockImage(300, 300);

    const result = await HighResolutionManager.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.STEPPED,
    });

    // usedJSHeapSize=128MB → memoryPeakUsageMB ≈ 128
    expect(result.memoryPeakUsageMB).toBeCloseTo(128, 0);
  });
});
