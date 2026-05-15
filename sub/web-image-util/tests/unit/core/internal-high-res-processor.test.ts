/**
 * InternalHighResProcessor 전략 선택 분기 단위 테스트
 *
 * 검증 대상:
 *  - validateProcessingCapability: forceStrategy 우회 · 메모리 부족 임계 ·
 *    quality별 분기(fast/high/balanced) · 반환 구조
 *  - smartResize → executeProcessing 디스패치: 전략별 위임 처리기 호출 여부
 *  - batchSmartResize: 청크 분할 · 진행 콜백
 *
 * @internal 모듈을 직접 상대경로로 import한다. export 시그니처 변경 시
 * 의도된 회귀 신호로 취급한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessingStrategy } from '../../../src/base/high-res-detector';
import { SteppedProcessor } from '../../../src/base/stepped-processor';
import { TiledProcessor } from '../../../src/base/tiled-processor';
import { InternalHighResProcessor } from '../../../src/core/internal/internal-high-res-processor';

// ---------------------------------------------------------------------------
// 픽스처 헬퍼
// ---------------------------------------------------------------------------

/**
 * width · height만 제어하는 이미지 픽스처.
 * 실제 디코딩 없이 분기 결정에 필요한 치수만 노출한다.
 */
function createMockImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  return img;
}

/**
 * drawImage 소스로 실제 동작하는 Canvas 기반 픽스처.
 * DIRECT 전략 테스트에서 ctx.drawImage 가 실패하지 않도록 Canvas를 사용한다.
 */
function createDrawableCanvas(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

/** 스파이가 반환할 가짜 Canvas */
function makeFakeCanvas(w = 100, h = 100): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------------------------------------------------------------------------
// performance.memory 모킹 헬퍼
// ---------------------------------------------------------------------------

/**
 * isMemoryLow() 가 true 를 반환하도록 performance.memory 를 주입한다.
 * usedJSHeapSize / jsHeapSizeLimit = 0.9 > 0.8 조건을 만족시킨다.
 */
function applyLowMemoryState(): PropertyDescriptor | undefined {
  const original = Object.getOwnPropertyDescriptor(performance, 'memory');
  Object.defineProperty(performance, 'memory', {
    value: {
      usedJSHeapSize: 900_000_000,
      jsHeapSizeLimit: 1_000_000_000,
      totalJSHeapSize: 1_000_000_000,
    },
    configurable: true,
    writable: true,
  });
  return original;
}

function removeLowMemoryState(original: PropertyDescriptor | undefined): void {
  if (original !== undefined) {
    Object.defineProperty(performance, 'memory', original);
  } else {
    // 처음에 없던 속성이면 완전히 삭제해 'memory' in performance 가 false 가 되게 한다
    delete (performance as any).memory;
  }
}

// ===========================================================================
// validateProcessingCapability — 전략 추천 분기
// ===========================================================================

describe('validateProcessingCapability — 전략 추천 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // forceStrategy 우회 분기
  // -------------------------------------------------------------------------
  describe('forceStrategy 우회 분기', () => {
    it('forceStrategy=TILED 이면 이미지 크기와 무관하게 TILED 가 반환된다', () => {
      const img = createMockImage(100, 100);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.TILED,
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
    });

    it('forceStrategy=DIRECT 이면 큰 이미지에서도 DIRECT 가 반환된다', () => {
      // 6000×6000 ≈ 137MB → 자동 선택이면 TILED 또는 CHUNKED 가 될 크기
      const img = createMockImage(6000, 6000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
    });

    it('forceStrategy=STEPPED 이면 recommendedStrategy 가 STEPPED 이다', () => {
      const img = createMockImage(500, 500);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.STEPPED,
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.STEPPED);
    });

    it('forceStrategy=CHUNKED 이면 recommendedStrategy 가 CHUNKED 이다', () => {
      const img = createMockImage(500, 500);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.CHUNKED,
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.CHUNKED);
    });
  });

  // -------------------------------------------------------------------------
  // 메모리 부족 분기 — selectMemoryEfficientStrategy
  // 임계: >128MB → TILED, >32MB → CHUNKED, else → DIRECT
  // isMemoryLow()=true 를 만들기 위해 performance.memory 를 주입한다.
  // -------------------------------------------------------------------------
  describe('메모리 부족 분기 — selectMemoryEfficientStrategy', () => {
    let savedMemoryDescriptor: PropertyDescriptor | undefined;

    beforeEach(() => {
      savedMemoryDescriptor = applyLowMemoryState();
    });

    afterEach(() => {
      removeLowMemoryState(savedMemoryDescriptor);
    });

    it('estimatedMemoryMB > 128 이면 TILED 를 추천한다', () => {
      // 6000×6000 = 36,000,000 pixels → ~137MB > 128MB
      const img = createMockImage(6000, 6000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
    });

    it('estimatedMemoryMB > 32 이고 ≤ 128 이면 CHUNKED 를 추천한다', () => {
      // 3000×3000 = 9,000,000 pixels → ~34MB, 32 < 34 ≤ 128
      const img = createMockImage(3000, 3000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.CHUNKED);
    });

    it('estimatedMemoryMB ≤ 32 이면 DIRECT 를 추천한다', () => {
      // 2000×2000 = 4,000,000 pixels → ~15MB ≤ 32MB
      const img = createMockImage(2000, 2000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
    });

    it('forceStrategy 가 있으면 메모리 부족 상태에서도 forceStrategy 가 우선된다', () => {
      // isMemoryLow()=true 이지만 forceStrategy 가 먼저 체크됨
      const img = createMockImage(6000, 6000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
    });
  });

  // -------------------------------------------------------------------------
  // quality='fast' 분기 — selectFastStrategy
  // 임계: ≤64MB → DIRECT, ≤128MB → CHUNKED, else → TILED
  // -------------------------------------------------------------------------
  describe("quality='fast' 분기 — selectFastStrategy", () => {
    it('estimatedMemoryMB ≤ 64 이면 DIRECT 를 추천한다', () => {
      // 4000×4000 = 16,000,000 pixels → ~61MB ≤ 64MB
      const img = createMockImage(4000, 4000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        quality: 'fast',
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
    });

    it('estimatedMemoryMB > 64 이고 ≤ 128 이면 CHUNKED 를 추천한다', () => {
      // 4500×4500 = 20,250,000 pixels → ~77MB, 64 < 77 ≤ 128
      const img = createMockImage(4500, 4500);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        quality: 'fast',
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.CHUNKED);
    });

    it('estimatedMemoryMB > 128 이면 TILED 를 추천한다', () => {
      // 6000×6000 = 36,000,000 pixels → ~137MB > 128MB
      const img = createMockImage(6000, 6000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        quality: 'fast',
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
    });
  });

  // -------------------------------------------------------------------------
  // quality='high' 분기 — selectHighQualityStrategy
  // - scaleRatio < 0.3 && estimatedMemoryMB ≤ 256 → STEPPED
  // - estimatedMemoryMB > 256 → TILED
  // - else → analysis.strategy
  // -------------------------------------------------------------------------
  describe("quality='high' 분기 — selectHighQualityStrategy", () => {
    it('scaleRatio < 0.3 이고 estimatedMemoryMB ≤ 256 이면 STEPPED 를 추천한다', () => {
      // 2000×2000 → 100×100: scaleRatio = min(100/2000, 100/2000) = 0.05 < 0.3
      // estimatedMemoryMB ≈ 15MB ≤ 256
      const img = createMockImage(2000, 2000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        quality: 'high',
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.STEPPED);
    });

    it('estimatedMemoryMB > 256 이면 TILED 를 추천한다', () => {
      // 8200×8200 = 67,240,000 pixels → ~256.5MB > 256MB
      // scaleRatio = 100/8200 ≈ 0.012 < 0.3 이지만 estimatedMemoryMB > 256 이므로 TILED
      const img = createMockImage(8200, 8200);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        quality: 'high',
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
    });

    it('scaleRatio ≥ 0.3 이고 estimatedMemoryMB ≤ 256 이면 analysis.strategy 를 그대로 반환한다', () => {
      // 1000×1000 → 500×500: scaleRatio = 0.5 ≥ 0.3
      // estimatedMemoryMB ≈ 3.8MB ≤ 256 → analysis.strategy = DIRECT (16MB 이하)
      const img = createMockImage(1000, 1000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 500, 500, {
        quality: 'high',
      });
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
    });
  });

  // -------------------------------------------------------------------------
  // quality='balanced' 기본값 분기
  // isMemoryLow()=false(jsdom), forceStrategy 없음 → analysis.strategy 반환
  // -------------------------------------------------------------------------
  describe("quality='balanced' 기본값 분기", () => {
    it('balanced 품질 + 소형 이미지는 analysis.strategy(DIRECT) 를 그대로 반환한다', () => {
      // 1000×1000 → ~3.8MB < 16MB → HighResolutionDetector: DIRECT
      const img = createMockImage(1000, 1000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
    });

    it('balanced 품질 + 중형 이미지는 analysis.strategy(CHUNKED) 를 그대로 반환한다', () => {
      // 2200×2200 = 4,840,000 pixels → ~18.5MB, 16MB < 18.5MB ≤ 64MB → CHUNKED
      const img = createMockImage(2200, 2200);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.CHUNKED);
    });
  });

  // -------------------------------------------------------------------------
  // 반환 구조 계약
  // -------------------------------------------------------------------------
  describe('반환 구조 계약', () => {
    it('결과에 canProcess · analysis · recommendedStrategy · warnings · estimatedTime 이 모두 있다', () => {
      const img = createMockImage(500, 500);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);

      expect(result).toHaveProperty('canProcess');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('recommendedStrategy');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('estimatedTime');
    });

    it('warnings 는 배열이고 estimatedTime 은 숫자다', () => {
      const img = createMockImage(100, 100);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 50, 50);

      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.estimatedTime).toBe('number');
    });

    it('analysis 에 width · height · estimatedMemoryMB 가 포함된다', () => {
      const img = createMockImage(400, 300);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);

      expect(result.analysis.width).toBe(400);
      expect(result.analysis.height).toBe(300);
      expect(typeof result.analysis.estimatedMemoryMB).toBe('number');
    });

    it('maxMemoryUsageMB 를 초과하면 warnings 에 메모리 초과 메시지가 포함된다', () => {
      // 6000×6000 ≈ 137MB > maxMemoryUsageMB=50MB
      const img = createMockImage(6000, 6000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        maxMemoryUsageMB: 50,
      });

      const hasMemoryWarning = result.warnings.some((w) => w.includes('MB'));
      expect(hasMemoryWarning).toBe(true);
    });

    it('TILED forceStrategy 는 DIRECT forceStrategy 보다 estimatedTime 이 크다 (×2.0 배율 반영)', () => {
      // 중형 이미지를 사용해 Math.max(0.1, ...) 바닥값 영향을 피한다
      const img = createMockImage(2200, 2200);
      const directResult = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });
      const tiledResult = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.TILED,
      });
      expect(tiledResult.estimatedTime).toBeGreaterThan(directResult.estimatedTime);
    });

    it('STEPPED forceStrategy 는 DIRECT forceStrategy 보다 estimatedTime 이 크다 (×1.5 배율 반영)', () => {
      const img = createMockImage(2200, 2200);
      const directResult = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });
      const steppedResult = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.STEPPED,
      });
      expect(steppedResult.estimatedTime).toBeGreaterThan(directResult.estimatedTime);
    });
  });
});

// ===========================================================================
// executeProcessing 디스패치 분기 — smartResize 경유
// 각 전략별로 올바른 위임 처리기가 호출되는지 확인한다.
// ===========================================================================

describe('executeProcessing 디스패치 분기 — smartResize 경유', () => {
  let tiledSpy: ReturnType<typeof vi.spyOn>;
  let steppedSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 실제 타일/스텝 렌더링을 차단하고 즉시 가짜 Canvas 를 반환한다
    tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(makeFakeCanvas());
    steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(makeFakeCanvas());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TILED 전략이면 TiledProcessor.resizeInTiles 가 호출된다', async () => {
    const img = createMockImage(500, 500);
    await InternalHighResProcessor.smartResize(img, 100, 100, {
      forceStrategy: ProcessingStrategy.TILED,
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    expect(steppedSpy).not.toHaveBeenCalled();
  });

  it('STEPPED 전략이면 SteppedProcessor.resizeWithSteps 가 호출된다', async () => {
    const img = createMockImage(500, 500);
    await InternalHighResProcessor.smartResize(img, 100, 100, {
      forceStrategy: ProcessingStrategy.STEPPED,
    });

    expect(steppedSpy).toHaveBeenCalledOnce();
    expect(tiledSpy).not.toHaveBeenCalled();
  });

  it('CHUNKED 전략이면 TiledProcessor.resizeInTiles 가 호출된다 (chunkedResize 내부 위임)', async () => {
    const img = createMockImage(500, 500);
    await InternalHighResProcessor.smartResize(img, 100, 100, {
      forceStrategy: ProcessingStrategy.CHUNKED,
    });

    expect(tiledSpy).toHaveBeenCalledOnce();
    expect(steppedSpy).not.toHaveBeenCalled();
  });

  it('DIRECT 전략이면 TiledProcessor 와 SteppedProcessor 를 호출하지 않는다', async () => {
    // drawImage 가 실제 동작해야 하므로 Canvas 소스를 사용한다
    const img = createDrawableCanvas(100, 100);
    await InternalHighResProcessor.smartResize(img, 50, 50, {
      forceStrategy: ProcessingStrategy.DIRECT,
    });

    expect(tiledSpy).not.toHaveBeenCalled();
    expect(steppedSpy).not.toHaveBeenCalled();
  });

  it('지원하지 않는 전략을 전달하면 RESIZE_FAILED 에러가 발생한다', async () => {
    const img = createMockImage(500, 500);
    await expect(
      InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: 'unknown-strategy' as any,
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'RESIZE_FAILED' }));
  });

  // quality 파라미터 → 처리기 옵션 전달 분기
  describe('quality 파라미터 전달 분기', () => {
    it("quality='fast' + TILED 이면 TiledProcessor 에 maxConcurrency=4 가 전달된다", async () => {
      const img = createMockImage(500, 500);
      await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: ProcessingStrategy.TILED,
        quality: 'fast',
      });

      expect(tiledSpy).toHaveBeenCalledOnce();
      const opts = tiledSpy.mock.calls[0]?.[3];
      expect(opts?.maxConcurrency).toBe(4);
    });

    it("quality='high' + TILED 이면 TiledProcessor 에 maxConcurrency=2 가 전달된다", async () => {
      const img = createMockImage(500, 500);
      await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: ProcessingStrategy.TILED,
        quality: 'high',
      });

      expect(tiledSpy).toHaveBeenCalledOnce();
      const opts = tiledSpy.mock.calls[0]?.[3];
      expect(opts?.maxConcurrency).toBe(2);
    });

    it("quality='fast' + STEPPED 이면 SteppedProcessor 에 quality='fast' 가 전달된다", async () => {
      const img = createMockImage(500, 500);
      await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: ProcessingStrategy.STEPPED,
        quality: 'fast',
      });

      expect(steppedSpy).toHaveBeenCalledOnce();
      const opts = steppedSpy.mock.calls[0]?.[3];
      expect(opts?.quality).toBe('fast');
    });

    it("quality='high' + STEPPED 이면 SteppedProcessor 에 maxSteps=15 가 전달된다", async () => {
      const img = createMockImage(500, 500);
      await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: ProcessingStrategy.STEPPED,
        quality: 'high',
      });

      expect(steppedSpy).toHaveBeenCalledOnce();
      const opts = steppedSpy.mock.calls[0]?.[3];
      expect(opts?.maxSteps).toBe(15);
    });

    it("quality='balanced'(기본) + STEPPED 이면 SteppedProcessor 에 maxSteps=8 이 전달된다", async () => {
      const img = createMockImage(500, 500);
      await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: ProcessingStrategy.STEPPED,
        // quality 미지정 → 기본값 'balanced'
      });

      expect(steppedSpy).toHaveBeenCalledOnce();
      const opts = steppedSpy.mock.calls[0]?.[3];
      // 'balanced' !== 'high' → maxSteps = 8
      expect(opts?.maxSteps).toBe(8);
    });
  });

  // smartResize 반환 구조
  describe('smartResize 반환 구조', () => {
    it('반환값에 canvas · analysis · strategy · processingTime · memoryPeakUsageMB · quality 가 있다', async () => {
      const img = createMockImage(500, 500);
      const result = await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: ProcessingStrategy.TILED,
      });

      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('memoryPeakUsageMB');
      expect(result).toHaveProperty('quality');
    });

    it('반환값의 strategy 는 지정한 forceStrategy 와 일치한다', async () => {
      const img = createMockImage(500, 500);
      const result = await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: ProcessingStrategy.STEPPED,
      });

      expect(result.strategy).toBe(ProcessingStrategy.STEPPED);
    });
  });
});

// ===========================================================================
// batchSmartResize — 청크 분할 · 진행 콜백
// ===========================================================================

describe('batchSmartResize — 청크 분할 · 진행 콜백', () => {
  beforeEach(() => {
    // 개별 처리 단위를 격리해 실제 렌더링 없이 즉시 결과를 반환한다
    vi.spyOn(InternalHighResProcessor, 'smartResize').mockResolvedValue({
      canvas: makeFakeCanvas(),
      analysis: {} as any,
      strategy: ProcessingStrategy.DIRECT,
      processingTime: 0,
      memoryPeakUsageMB: 0,
      quality: 'balanced',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('이미지 배열의 길이만큼 결과를 반환한다', async () => {
    const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(300, 300)];
    const results = await InternalHighResProcessor.batchSmartResize(images, 50, 50);

    expect(results).toHaveLength(3);
  });

  it('onBatchProgress 의 마지막 호출은 (완료 수, 전체 수) 가 일치한다', async () => {
    const onBatchProgress = vi.fn();
    const images = [createMockImage(100, 100), createMockImage(100, 100)];
    await InternalHighResProcessor.batchSmartResize(images, 50, 50, {
      onBatchProgress,
      concurrency: 1,
    });

    const calls = onBatchProgress.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toEqual([2, 2]);
  });

  it('onBatchProgress 호출 횟수는 이미지 수와 같다', async () => {
    const onBatchProgress = vi.fn();
    const images = Array.from({ length: 4 }, () => createMockImage(100, 100));
    await InternalHighResProcessor.batchSmartResize(images, 50, 50, {
      onBatchProgress,
      concurrency: 2,
    });

    expect(onBatchProgress).toHaveBeenCalledTimes(4);
  });

  it('빈 배열을 전달하면 빈 결과를 반환한다', async () => {
    const results = await InternalHighResProcessor.batchSmartResize([], 50, 50);
    expect(results).toHaveLength(0);
  });

  it('concurrency=1 이면 이미지 순서대로 처리된다 (smartResize 호출 수 = 이미지 수)', async () => {
    const smartResizeSpy = vi.mocked(InternalHighResProcessor.smartResize);
    const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(300, 300)];

    await InternalHighResProcessor.batchSmartResize(images, 50, 50, { concurrency: 1 });

    expect(smartResizeSpy).toHaveBeenCalledTimes(3);
  });
});
