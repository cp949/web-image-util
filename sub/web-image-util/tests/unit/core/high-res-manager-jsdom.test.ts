/**
 * HighResolutionManager 수동 제어 진입점 행동 테스트
 *
 * validateProcessingCapability / smartResize / batchSmartResize 세 메서드의
 * 옵션 전달 계약, 반환 형태, 진행률 콜백을 검증한다.
 * 실제 Canvas 렌더는 jsdom 환경에서 의미가 흔들리므로
 * STEPPED/TILED 경로는 vi.spyOn 으로 격리하고, DIRECT 경로는
 * canvas 를 소스로 쓰는 소형 이미지로 직접 호출한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessingStrategy } from '../../../src/base/high-res-detector';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { SteppedProcessor } from '../../../src/base/stepped-processor';
import { TiledProcessor } from '../../../src/base/tiled-processor';

// width / height 를 Object.defineProperty 로 제어하는 mock 이미지
// drawImage 소스로 사용하지 않는 경우(analyzeImage, validateProcessingCapability 등)에 사용
function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  return img;
}

// drawImage 소스로 사용 가능한 canvas 기반 이미지 픽스처
// jsdom+canvas 환경에서 HTMLImageElement.drawImage 는 src 없이 실패하므로
// Canvas 를 소스로 사용한다
function createDrawableImage(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

// ProcessingResult 기본 스텁 반환값
function makeProcessingResult(overrides: Partial<{ canvas: HTMLCanvasElement }> = {}) {
  const canvas = overrides.canvas ?? document.createElement('canvas');
  return {
    canvas,
    analysis: {} as any,
    strategy: ProcessingStrategy.DIRECT,
    processingTime: 0.1,
    memoryPeakUsageMB: 0,
    quality: 'balanced' as const,
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe('HighResolutionManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // validateProcessingCapability — 반환 형태와 분기
  // --------------------------------------------------------------------------
  describe('validateProcessingCapability', () => {
    it('반환 객체는 필수 키(canProcess, analysis, recommendedStrategy, warnings, estimatedTime)를 모두 갖는다', () => {
      const img = createMockImage(100, 100);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

      expect(result).toHaveProperty('canProcess');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('recommendedStrategy');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('estimatedTime');
    });

    it('작은 이미지(100×100)는 canProcess=true 이고 warnings 가 비어 있다', () => {
      const img = createMockImage(100, 100);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

      expect(result.canProcess).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('estimatedTime 은 숫자다', () => {
      const img = createMockImage(100, 100);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

      expect(typeof result.estimatedTime).toBe('number');
    });

    it('warnings 는 배열이다', () => {
      const img = createMockImage(100, 100);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('forceStrategy="tiled" 이면 recommendedStrategy 가 "tiled" 이다', () => {
      const img = createMockImage(100, 100);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50, {
        forceStrategy: ProcessingStrategy.TILED,
      });

      expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
    });

    it('forceStrategy="stepped" 이면 recommendedStrategy 가 "stepped" 이다', () => {
      const img = createMockImage(100, 100);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50, {
        forceStrategy: ProcessingStrategy.STEPPED,
      });

      expect(result.recommendedStrategy).toBe(ProcessingStrategy.STEPPED);
    });

    it('maxMemoryUsageMB 보다 estimatedMemoryMB 가 크면 warnings 에 메모리 초과 메시지가 포함된다', () => {
      // 1000×1000 = 1MP → estimatedMemoryMB ≈ 3.8MB > 2MB(낮은 상한)
      const img = createMockImage(1000, 1000);
      const result = HighResolutionManager.validateProcessingCapability(img, 500, 500, {
        maxMemoryUsageMB: 2,
      });

      const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory') || w.includes('MB'));
      expect(hasMemWarning).toBe(true);
    });

    it('maxMemoryUsageMB 가 충분히 크면 메모리 초과 경고가 없다', () => {
      // 100×100 → estimatedMemoryMB ≈ 0.04MB < 1000MB
      const img = createMockImage(100, 100);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50, {
        maxMemoryUsageMB: 1000,
      });

      const hasMemWarning = result.warnings.some(
        (w) => w.toLowerCase().includes('exceeds') || w.toLowerCase().includes('memory usage')
      );
      expect(hasMemWarning).toBe(false);
    });

    it('목표 크기가 maxSafeDimension 을 크게 초과하면 warnings 에 브라우저 한계 안내가 포함된다', () => {
      const img = createMockImage(100, 100);
      // jsdom UA 기준 maxSafeDimension = 16384 → 20000×20000 은 초과
      const result = HighResolutionManager.validateProcessingCapability(img, 20000, 20000);

      const hasLimitWarning = result.warnings.some(
        (w) => w.toLowerCase().includes('limit') || w.toLowerCase().includes('browser') || w.includes('size')
      );
      expect(hasLimitWarning).toBe(true);
    });

    it('analysis 에는 width, height, estimatedMemoryMB 가 포함된다', () => {
      const img = createMockImage(200, 300);
      const result = HighResolutionManager.validateProcessingCapability(img, 100, 100);

      expect(result.analysis.width).toBe(200);
      expect(result.analysis.height).toBe(300);
      expect(typeof result.analysis.estimatedMemoryMB).toBe('number');
    });

    it('forceStrategy 미지정 + 작은 이미지(100×100) → 자동 분석 경로에서 recommendedStrategy 가 "direct" 다', () => {
      const img = createMockImage(100, 100);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);
      // isMemoryLow()=false(jsdom에 performance.memory 없음), quality='balanced'
      // → analysis.strategy 폴백: 100×100×4=40000 bytes < 16MB → DIRECT
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
    });

    it('forceStrategy 미지정 + 큰 이미지(2200×2200) → 자동 분석 경로에서 recommendedStrategy 가 "chunked" 다', () => {
      const img = createMockImage(2200, 2200);
      const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000);
      // 2200×2200×4 ≈ 18.5MB → SMALL(16MB) 초과, MEDIUM(64MB) 이하 → CHUNKED
      expect(result.recommendedStrategy).toBe(ProcessingStrategy.CHUNKED);
    });

    it('STEPPED forceStrategy 는 DIRECT forceStrategy 보다 estimatedTime 이 크다(×1.5 보정 적용)', () => {
      // 큰 이미지를 사용해 Math.max(0.1, ...) 바닥값 영향을 피한다
      const img = createMockImage(2200, 2200);
      const directResult = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });
      const steppedResult = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, {
        forceStrategy: ProcessingStrategy.STEPPED,
      });
      expect(steppedResult.estimatedTime).toBeGreaterThan(directResult.estimatedTime);
    });

    it('TILED forceStrategy 는 STEPPED forceStrategy 보다 estimatedTime 이 크다(×2.0 vs ×1.5 보정 적용)', () => {
      const img = createMockImage(2200, 2200);
      const steppedResult = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, {
        forceStrategy: ProcessingStrategy.STEPPED,
      });
      const tiledResult = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, {
        forceStrategy: ProcessingStrategy.TILED,
      });
      expect(tiledResult.estimatedTime).toBeGreaterThan(steppedResult.estimatedTime);
    });

    it('한 변이 maxSafeDimension×2 를 초과하지만 메모리는 1024MB 이하인 이미지(40000×200) → canProcess 가 false 다(차원 분기 단독)', () => {
      // maxSafeDimension=16384(jsdom UA 기준) → 16384×2=32768 < 40000 → 차원 분기만 트립
      // 메모리: 40000×200×4/(1024*1024)≈30MB < 1024MB → 메모리 분기는 비트립
      const img = createMockImage(40000, 200);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

      expect(result.canProcess).toBe(false);
      const hasDimWarning = result.warnings.some(
        (w) => w.toLowerCase().includes('canvas') || w.toLowerCase().includes('limit')
      );
      expect(hasDimWarning).toBe(true);
    });

    it('두 변이 maxSafeDimension×2 이하이지만 메모리가 1024MB 초과인 이미지(17000×17000) → canProcess 가 false 다(메모리 분기 단독)', () => {
      // 메모리: 17000×17000×4/(1024*1024)≈1102MB > 1024MB → 메모리 분기만 트립
      // 최대 변: 17000 < 32768(16384×2) → 차원 분기는 비트립
      const img = createMockImage(17000, 17000);
      const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

      expect(result.canProcess).toBe(false);
      const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory'));
      expect(hasMemWarning).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // smartResize — 반환 형태와 quality 전달
  // --------------------------------------------------------------------------
  describe('smartResize — 반환 형태와 quality 전달', () => {
    it('ProcessingResult 필수 키(canvas, strategy, quality, processingTime, memoryPeakUsageMB, analysis)를 모두 반환한다', async () => {
      // 작은 이미지 + DIRECT 경로 → canvas drawImage 직접 수행 (jsdom+canvas에서 동작)
      const img = createDrawableImage(100, 100);
      const result = await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });

      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('memoryPeakUsageMB');
      expect(result).toHaveProperty('analysis');
    });

    it('quality 기본값은 "balanced" 다', async () => {
      const img = createDrawableImage(100, 100);
      const result = await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });

      expect(result.quality).toBe('balanced');
    });

    it('quality: "fast" 가 반환값 quality 에 반영된다', async () => {
      const img = createDrawableImage(100, 100);
      const result = await HighResolutionManager.smartResize(img, 50, 50, {
        quality: 'fast',
        forceStrategy: ProcessingStrategy.DIRECT,
      });

      expect(result.quality).toBe('fast');
    });

    it('quality: "high" 가 반환값 quality 에 반영된다', async () => {
      const img = createDrawableImage(100, 100);
      const result = await HighResolutionManager.smartResize(img, 50, 50, {
        quality: 'high',
        forceStrategy: ProcessingStrategy.DIRECT,
      });

      expect(result.quality).toBe('high');
    });

    it('반환된 canvas 는 HTMLCanvasElement 다', async () => {
      const img = createDrawableImage(100, 100);
      const result = await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    });

    it('반환된 canvas 는 targetWidth×targetHeight 크기다', async () => {
      const img = createDrawableImage(200, 200);
      const result = await HighResolutionManager.smartResize(img, 80, 60, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });

      expect(result.canvas.width).toBe(80);
      expect(result.canvas.height).toBe(60);
    });

    it('processingTime 은 음수가 아닌 숫자다', async () => {
      const img = createDrawableImage(100, 100);
      const result = await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
      });

      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // smartResize — forceStrategy 전달 계약
  // --------------------------------------------------------------------------
  describe('smartResize — forceStrategy 전달 계약', () => {
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

  // --------------------------------------------------------------------------
  // smartResize — 진행률 콜백
  // --------------------------------------------------------------------------
  describe('smartResize — 진행률 콜백', () => {
    it('enableProgressTracking=true 이고 onProgress 를 넘기면 onProgress 가 호출된다', async () => {
      const onProgress = vi.fn();
      const img = createDrawableImage(100, 100);
      await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
        enableProgressTracking: true,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
    });

    it('onProgress 는 HighResolutionProgress 형태(stage, progress, currentStrategy, timeElapsed, estimatedTimeRemaining, memoryUsageMB)를 인자로 받는다', async () => {
      const progressArgs: any[] = [];
      const onProgress = vi.fn((p) => progressArgs.push(p));
      const img = createDrawableImage(100, 100);
      await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
        enableProgressTracking: true,
        onProgress,
      });

      expect(progressArgs.length).toBeGreaterThan(0);
      const firstArg = progressArgs[0];
      expect(firstArg).toHaveProperty('stage');
      expect(firstArg).toHaveProperty('progress');
      expect(firstArg).toHaveProperty('currentStrategy');
      expect(firstArg).toHaveProperty('timeElapsed');
      expect(firstArg).toHaveProperty('estimatedTimeRemaining');
      expect(firstArg).toHaveProperty('memoryUsageMB');
    });

    it('progress 값은 0~100 범위다', async () => {
      const progressValues: number[] = [];
      const onProgress = vi.fn((p) => progressValues.push(p.progress));
      const img = createDrawableImage(100, 100);
      await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
        enableProgressTracking: true,
        onProgress,
      });

      for (const v of progressValues) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });

    it('enableProgressTracking=false(기본)이면 onProgress 는 호출되지 않는다', async () => {
      const onProgress = vi.fn();
      const img = createDrawableImage(100, 100);
      await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
        // enableProgressTracking 미지정 → 기본값 false
        onProgress,
      });

      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // smartResize — onMemoryWarning 콜백
  // --------------------------------------------------------------------------
  // jsdom 환경에는 performance.memory 가 없으므로 getEstimatedUsage()가
  // 폴백 값(used=64MB, limit=512MB)을 반환한다 → availableMB ≈ 448MB.
  // 따라서 maxMemoryUsageMB 를 448 보다 크게/작게 주면 발화 분기를 강제할 수 있다.
  describe('smartResize — onMemoryWarning 콜백', () => {
    it('availableMB 가 maxMemoryUsageMB 미만이면 onMemoryWarning 이 호출된다', async () => {
      // 448 < 500 → 발화
      const onMemoryWarning = vi.fn();
      const img = createDrawableImage(100, 100);
      await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
        maxMemoryUsageMB: 500,
        onMemoryWarning,
      });

      expect(onMemoryWarning).toHaveBeenCalled();
    });

    it('onMemoryWarning 호출 인자는 { usageRatio, availableMB } 형태다', async () => {
      const calls: Array<{ usageRatio: number; availableMB: number }> = [];
      const onMemoryWarning = vi.fn((info) => calls.push(info));
      const img = createDrawableImage(100, 100);
      await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
        maxMemoryUsageMB: 500,
        onMemoryWarning,
      });

      expect(calls.length).toBeGreaterThan(0);
      const arg = calls[0]!;
      expect(typeof arg.usageRatio).toBe('number');
      expect(typeof arg.availableMB).toBe('number');
      // 폴백 추정: usageRatio = 64/512 = 0.125, availableMB = round(448) = 448
      expect(arg.usageRatio).toBeGreaterThanOrEqual(0);
      expect(arg.usageRatio).toBeLessThanOrEqual(1);
      expect(arg.availableMB).toBeGreaterThan(0);
    });

    it('availableMB 가 maxMemoryUsageMB 이상이면 onMemoryWarning 이 호출되지 않는다', async () => {
      // 448 >= 64 → 미발화
      const onMemoryWarning = vi.fn();
      const img = createDrawableImage(100, 100);
      await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
        maxMemoryUsageMB: 64,
        onMemoryWarning,
      });

      expect(onMemoryWarning).not.toHaveBeenCalled();
    });

    it('maxMemoryUsageMB 미지정(기본 256) + jsdom 폴백(available≈448) → 미발화', async () => {
      // 기본값 분기 보호: 448 >= 256 → 미발화
      const onMemoryWarning = vi.fn();
      const img = createDrawableImage(100, 100);
      await HighResolutionManager.smartResize(img, 50, 50, {
        forceStrategy: ProcessingStrategy.DIRECT,
        onMemoryWarning,
        // maxMemoryUsageMB 미지정 → 기본값 256
      });

      expect(onMemoryWarning).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // batchSmartResize — 배치 계약
  // --------------------------------------------------------------------------
  describe('batchSmartResize', () => {
    let smartResizeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // batchSmartResize 는 내부적으로 smartResize 를 위임하므로 spy 로 격리
      // mockImplementation 으로 호출마다 고유한 canvas 를 반환해
      // 결과 배열의 구멍(undefined)과 globalIndex 매핑 오류를 검출 가능하게 한다
      smartResizeSpy = vi.spyOn(HighResolutionManager, 'smartResize').mockImplementation(async (img) => {
        const canvas = document.createElement('canvas');
        (canvas as any).__imageRef = img;
        return makeProcessingResult({ canvas }) as any;
      });
    });

    it('이미지 2개 → 결과 배열 길이 2', async () => {
      const images = [createMockImage(100, 100), createMockImage(100, 100)];
      const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

      expect(results).toHaveLength(2);
    });

    it('이미지 3개 → 결과 배열 길이 3', async () => {
      const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(150, 150)];
      const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

      expect(results).toHaveLength(3);
    });

    it('각 결과는 canvas 를 갖는다', async () => {
      const images = [createMockImage(100, 100), createMockImage(100, 100)];
      const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

      for (const r of results) {
        expect(r).toHaveProperty('canvas');
        expect(r.canvas).toBeInstanceOf(HTMLCanvasElement);
      }
    });

    it('smartResize 는 이미지 수만큼 호출된다', async () => {
      const images = [createMockImage(100, 100), createMockImage(100, 100), createMockImage(100, 100)];
      await HighResolutionManager.batchSmartResize(images, 50, 50);

      expect(smartResizeSpy).toHaveBeenCalledTimes(3);
    });

    it('onBatchProgress 는 이미지 완료마다 호출된다', async () => {
      const onBatchProgress = vi.fn();
      const images = [createMockImage(100, 100), createMockImage(100, 100)];
      await HighResolutionManager.batchSmartResize(images, 50, 50, { onBatchProgress });

      expect(onBatchProgress).toHaveBeenCalledTimes(2);
    });

    it('마지막 onBatchProgress 호출 시 completed === images.length 다', async () => {
      const calls: Array<[number, number]> = [];
      const onBatchProgress = vi.fn((completed, total) => calls.push([completed, total]));
      const images = [createMockImage(100, 100), createMockImage(100, 100), createMockImage(100, 100)];
      await HighResolutionManager.batchSmartResize(images, 50, 50, { onBatchProgress });

      const last = calls[calls.length - 1];
      expect(last?.[0]).toBe(images.length);
    });

    it('onBatchProgress 의 두 번째 인자(total)는 항상 images.length 다', async () => {
      const calls: Array<[number, number]> = [];
      const onBatchProgress = vi.fn((completed, total) => calls.push([completed, total]));
      const images = [createMockImage(100, 100), createMockImage(100, 100)];
      await HighResolutionManager.batchSmartResize(images, 50, 50, { onBatchProgress });

      for (const [, total] of calls) {
        expect(total).toBe(images.length);
      }
    });

    it('이미지 배열이 비어 있으면 빈 배열을 반환한다', async () => {
      const results = await HighResolutionManager.batchSmartResize([], 50, 50);

      expect(results).toHaveLength(0);
    });

    it('결과 배열에 undefined 구멍이 없다(3개 입력, 청크 2개)', async () => {
      // concurrency=2 기본값 → chunk[0]=[img0,img1], chunk[1]=[img2]
      // globalIndex 오류 시 results[2] 가 sparse hole 로 남을 수 있다
      // Array.from 으로 sparse hole 을 실제 undefined 로 구체화한 뒤 단정
      const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(150, 150)];
      const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

      expect(Array.from(results)).not.toContain(undefined);
    });

    it('3개 이미지(청크 2개) — results[i]는 images[i]에 대응한다(globalIndex 매핑 검증)', async () => {
      // globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex
      // 오류 시 results[i].canvas.__imageRef 가 images[i] 와 불일치
      const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(150, 150)];
      const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

      for (let i = 0; i < images.length; i++) {
        expect((results[i].canvas as any).__imageRef).toBe(images[i]);
      }
    });

    it('smartResize 에 targetWidth/targetHeight/processingOptions 가 그대로 전달된다', async () => {
      // 회귀 위험: targetWidth/Height 뒤바뀜 or processingOptions 누락 시 배치 경로 전체가 조용히 오작동
      // concurrency/onBatchProgress 는 batchSmartResize 자체가 소비하고 smartResize 에는 전달하지 않는다
      const images = [createMockImage(100, 100), createMockImage(200, 200)];
      const onBatchProgress = vi.fn();
      const onProgress = vi.fn();

      await HighResolutionManager.batchSmartResize(images, 300, 200, {
        quality: 'high',
        forceStrategy: 'direct',
        concurrency: 1,
        onBatchProgress,
        onProgress,
      });

      expect(smartResizeSpy).toHaveBeenCalledTimes(2);

      for (let i = 0; i < images.length; i++) {
        const call = smartResizeSpy.mock.calls[i] as unknown[];
        // 2번 인자: targetWidth, 3번 인자: targetHeight
        expect(call[1]).toBe(300);
        expect(call[2]).toBe(200);
        // 4번 인자: processingOptions — quality/forceStrategy/onProgress 포함
        const processingOptions = call[3] as Record<string, unknown>;
        expect(processingOptions).toMatchObject({ quality: 'high', forceStrategy: 'direct', onProgress });
        // concurrency/onBatchProgress 는 전달되면 안 된다
        expect(processingOptions).not.toHaveProperty('concurrency');
        expect(processingOptions).not.toHaveProperty('onBatchProgress');
      }
    });

    // ------------------------------------------------------------------------
    // 오류 래핑 — 한 이미지 실패 시 ImageProcessError(RESIZE_FAILED) + 컨텍스트 보존
    // ------------------------------------------------------------------------
    // 회귀 위험: 사용자가 의도된 ImageProcessError(코드/원인/실패 인덱스) 대신
    // raw 에러를 받게 되면 디버깅 컨텍스트가 사라진다.
    it('한 이미지가 실패하면 ImageProcessError(코드=RESIZE_FAILED)로 래핑되어 던져진다', async () => {
      const innerError = new Error('boom');
      // beforeEach 의 mockImplementation 위에 1회 실패를 큐잉한다
      smartResizeSpy.mockRejectedValueOnce(innerError);
      const images = [createMockImage(100, 100), createMockImage(100, 100)];

      await expect(HighResolutionManager.batchSmartResize(images, 50, 50)).rejects.toMatchObject({
        name: 'ImageProcessError',
        code: 'RESIZE_FAILED',
      });
    });

    it('래핑된 에러는 cause 로 원래 에러를 보존한다', async () => {
      const innerError = new Error('boom');
      smartResizeSpy.mockRejectedValueOnce(innerError);
      const images = [createMockImage(100, 100), createMockImage(100, 100)];

      try {
        await HighResolutionManager.batchSmartResize(images, 50, 50);
        throw new Error('던져졌어야 한다');
      } catch (err: unknown) {
        expect((err as { cause?: unknown }).cause).toBe(innerError);
      }
    });

    it('래핑된 에러는 context.debug.stage="Batch processing" 과 실패 index 를 보존한다', async () => {
      const innerError = new Error('boom');
      // 첫 호출만 실패 → globalIndex=0 (concurrency=2 기본, chunk[0]=[img0,img1])
      smartResizeSpy.mockRejectedValueOnce(innerError);
      const images = [createMockImage(100, 100), createMockImage(100, 100)];

      try {
        await HighResolutionManager.batchSmartResize(images, 50, 50);
        throw new Error('던져졌어야 한다');
      } catch (err: unknown) {
        const ctx = (err as { context?: { debug?: { stage?: unknown; index?: unknown } } }).context;
        expect(ctx?.debug?.stage).toBe('Batch processing');
        expect(ctx?.debug?.index).toBe(0);
      }
    });
  });
});
