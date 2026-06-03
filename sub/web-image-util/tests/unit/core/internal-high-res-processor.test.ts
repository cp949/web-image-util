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
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { SteppedProcessor } from '../../../src/base/stepped-processor';
import { TiledProcessor } from '../../../src/base/tiled-processor';
import { InternalHighResProcessor } from '../../../src/core/internal/internal-high-res-processor';
import {
  applyLowMemoryState,
  createDrawableCanvas,
  createMockImage,
  makeFakeCanvas,
  removeLowMemoryState,
} from './internal-high-res-processor.helpers';

describe('InternalHighResProcessor 구현 공유 계약', () => {
  it('HighResolutionManager 와 동일한 static 처리 메서드를 공유한다', () => {
    expect(InternalHighResProcessor.smartResize).toBe(HighResolutionManager.smartResize);
    expect(InternalHighResProcessor.validateProcessingCapability).toBe(
      HighResolutionManager.validateProcessingCapability
    );
    expect(InternalHighResProcessor.batchSmartResize).toBe(HighResolutionManager.batchSmartResize);
  });
});

describe('validateProcessingCapability — 전략 추천 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('forceStrategy 우회 분기', () => {
    const cases = [
      ['TILED', ProcessingStrategy.TILED, 100, 100],
      ['DIRECT', ProcessingStrategy.DIRECT, 6000, 6000],
      ['STEPPED', ProcessingStrategy.STEPPED, 500, 500],
      ['CHUNKED', ProcessingStrategy.CHUNKED, 500, 500],
    ] as const;

    it.each(cases)('forceStrategy=%s 이면 recommendedStrategy 가 %s 이다', (_, strategy, width, height) => {
      const img = createMockImage(width, height);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: strategy,
      });

      expect(result.recommendedStrategy).toBe(strategy);
    });
  });

  describe('메모리 부족 분기 — selectMemoryEfficientStrategy', () => {
    let savedMemoryDescriptor: PropertyDescriptor | undefined;

    beforeEach(() => {
      savedMemoryDescriptor = applyLowMemoryState();
    });

    afterEach(() => {
      removeLowMemoryState(savedMemoryDescriptor);
    });

    const memoryCases = [
      ['estimatedMemoryMB > 128', 6000, 6000, ProcessingStrategy.TILED],
      ['estimatedMemoryMB > 32 이고 ≤ 128', 3000, 3000, ProcessingStrategy.CHUNKED],
      ['estimatedMemoryMB ≤ 32', 2000, 2000, ProcessingStrategy.DIRECT],
    ] as const;

    it.each(memoryCases)('%s 이면 %s 를 추천한다', (_, width, height, expectedStrategy) => {
      const img = createMockImage(width, height);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);

      expect(result.recommendedStrategy).toBe(expectedStrategy);
    });

    it('forceStrategy 가 있으면 메모리 부족 상태에서도 forceStrategy 가 우선된다', () => {
      const img = createMockImage(6000, 6000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });

      expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
    });
  });

  describe("quality='fast' 분기 — selectFastStrategy", () => {
    const fastCases = [
      ['estimatedMemoryMB ≤ 64', 4000, 4000, ProcessingStrategy.DIRECT],
      ['estimatedMemoryMB > 64 이고 ≤ 128', 4500, 4500, ProcessingStrategy.CHUNKED],
      ['estimatedMemoryMB > 128', 6000, 6000, ProcessingStrategy.TILED],
    ] as const;

    it.each(fastCases)('%s 이면 %s 를 추천한다', (_, width, height, expectedStrategy) => {
      const img = createMockImage(width, height);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        quality: 'fast',
      });

      expect(result.recommendedStrategy).toBe(expectedStrategy);
    });
  });

  describe("quality='high' 분기 — selectHighQualityStrategy", () => {
    const highCases = [
      ['scaleRatio < 0.3 이고 estimatedMemoryMB ≤ 256', 2000, 2000, 100, 100, ProcessingStrategy.STEPPED],
      ['estimatedMemoryMB > 256', 8200, 8200, 100, 100, ProcessingStrategy.TILED],
      ['scaleRatio ≥ 0.3 이고 estimatedMemoryMB ≤ 256', 1000, 1000, 500, 500, ProcessingStrategy.DIRECT],
    ] as const;

    it.each(highCases)('%s 이면 %s 를 추천한다', (_, width, height, targetWidth, targetHeight, expectedStrategy) => {
      const img = createMockImage(width, height);
      const result = InternalHighResProcessor.validateProcessingCapability(img, targetWidth, targetHeight, {
        quality: 'high',
      });

      expect(result.recommendedStrategy).toBe(expectedStrategy);
    });
  });

  describe("quality='balanced' 기본값 분기", () => {
    const balancedCases = [
      ['소형 이미지', 1000, 1000, ProcessingStrategy.DIRECT],
      ['중형 이미지', 2200, 2200, ProcessingStrategy.CHUNKED],
    ] as const;

    it.each(
      balancedCases
    )('balanced 품질 + %s 는 analysis.strategy(%s) 를 그대로 반환한다', (_, width, height, expectedStrategy) => {
      const img = createMockImage(width, height);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);

      expect(result.recommendedStrategy).toBe(expectedStrategy);
    });
  });

  describe('반환 구조 계약', () => {
    it('결과에 공개 필드가 모두 있다', () => {
      const img = createMockImage(500, 500);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100);

      for (const property of ['canProcess', 'analysis', 'recommendedStrategy', 'warnings', 'estimatedTime']) {
        expect(result).toHaveProperty(property);
      }
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
      const img = createMockImage(6000, 6000);
      const result = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        maxMemoryUsageMB: 50,
      });

      expect(result.warnings.some((warning) => warning.includes('MB'))).toBe(true);
    });

    const estimatedTimeCases = [
      ['TILED', ProcessingStrategy.TILED],
      ['STEPPED', ProcessingStrategy.STEPPED],
    ] as const;

    it.each(
      estimatedTimeCases
    )('%s forceStrategy 는 DIRECT forceStrategy 보다 estimatedTime 이 크다', (_, strategy) => {
      const img = createMockImage(2200, 2200);
      const directResult = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });
      const comparedResult = InternalHighResProcessor.validateProcessingCapability(img, 100, 100, {
        forceStrategy: strategy,
      });

      expect(comparedResult.estimatedTime).toBeGreaterThan(directResult.estimatedTime);
    });
  });
});

describe('executeProcessing 디스패치 분기 — smartResize 경유', () => {
  let tiledSpy: ReturnType<typeof vi.spyOn>;
  let steppedSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(makeFakeCanvas());
    steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(makeFakeCanvas());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const dispatchCases = [
    ['TILED 전략이면 TiledProcessor.resizeInTiles 가 호출된다', ProcessingStrategy.TILED, true, false],
    ['STEPPED 전략이면 SteppedProcessor.resizeWithSteps 가 호출된다', ProcessingStrategy.STEPPED, false, true],
    [
      'CHUNKED 전략이면 TiledProcessor.resizeInTiles 가 호출된다 (chunkedResize 내부 위임)',
      ProcessingStrategy.CHUNKED,
      true,
      false,
    ],
  ] as const;

  it.each(dispatchCases)('%s', async (_, strategy, shouldCallTiled, shouldCallStepped) => {
    const img = createMockImage(500, 500);
    await InternalHighResProcessor.smartResize(img, 100, 100, {
      forceStrategy: strategy,
    });

    expect(tiledSpy).toHaveBeenCalledTimes(shouldCallTiled ? 1 : 0);
    expect(steppedSpy).toHaveBeenCalledTimes(shouldCallStepped ? 1 : 0);
  });

  it('DIRECT 전략이면 TiledProcessor 와 SteppedProcessor 를 호출하지 않는다', async () => {
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

  describe('quality 파라미터 전달 분기', () => {
    const optionCases = [
      [
        "quality='fast' + TILED 이면 TiledProcessor 에 maxConcurrency=4 가 전달된다",
        ProcessingStrategy.TILED,
        'fast',
        tiledOptions,
        'maxConcurrency',
        4,
      ],
      [
        "quality='high' + TILED 이면 TiledProcessor 에 maxConcurrency=2 가 전달된다",
        ProcessingStrategy.TILED,
        'high',
        tiledOptions,
        'maxConcurrency',
        2,
      ],
      [
        "quality='fast' + STEPPED 이면 SteppedProcessor 에 quality='fast' 가 전달된다",
        ProcessingStrategy.STEPPED,
        'fast',
        steppedOptions,
        'quality',
        'fast',
      ],
      [
        "quality='high' + STEPPED 이면 SteppedProcessor 에 maxSteps=15 가 전달된다",
        ProcessingStrategy.STEPPED,
        'high',
        steppedOptions,
        'maxSteps',
        15,
      ],
      [
        "quality='balanced'(기본) + STEPPED 이면 SteppedProcessor 에 maxSteps=8 이 전달된다",
        ProcessingStrategy.STEPPED,
        undefined,
        steppedOptions,
        'maxSteps',
        8,
      ],
    ] as const;

    it.each(optionCases)('%s', async (_, strategy, quality, getOptions, optionKey, expectedValue) => {
      const img = createMockImage(500, 500);
      await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: strategy,
        ...(quality !== undefined ? { quality } : {}),
      });

      expect(getOptions(tiledSpy, steppedSpy)?.[optionKey]).toBe(expectedValue);
    });
  });

  describe('smartResize 반환 구조', () => {
    it('반환값에 공개 필드가 모두 있다', async () => {
      const img = createMockImage(500, 500);
      const result = await InternalHighResProcessor.smartResize(img, 100, 100, {
        forceStrategy: ProcessingStrategy.TILED,
      });

      for (const property of ['canvas', 'analysis', 'strategy', 'processingTime', 'memoryPeakUsageMB', 'quality']) {
        expect(result).toHaveProperty(property);
      }
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

describe('batchSmartResize — 청크 분할 · 진행 콜백', () => {
  beforeEach(() => {
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
    expect(calls[calls.length - 1]).toEqual([2, 2]);
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

function tiledOptions(tiledSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown> | undefined {
  return tiledSpy.mock.calls[0]?.[3] as Record<string, unknown> | undefined;
}

function steppedOptions(
  _: ReturnType<typeof vi.spyOn>,
  steppedSpy: ReturnType<typeof vi.spyOn>
): Record<string, unknown> | undefined {
  return steppedSpy.mock.calls[0]?.[3] as Record<string, unknown> | undefined;
}
