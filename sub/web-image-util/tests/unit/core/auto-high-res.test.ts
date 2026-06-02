/**
 * AutoHighResProcessor 단위 테스트
 *
 * validateProcessing 의 임계치 기반 결정 로직과
 * smartResize 의 표준/고해상도 경로 분기를 검증한다.
 * HighResolutionManager 의 실제 렌더링 호출은 spy 로 격리한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import {
  AutoHighResProcessor,
  type AutoProcessingResult,
  smartResize,
  smartResizeWithProgress,
} from '../../../src/core/auto-high-res';

// img.width / img.height 를 제어하는 헬퍼 (drawImage 불필요한 경우)
function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

// drawImage 소스로 사용 가능한 Canvas 기반 이미지 헬퍼
// jsdom+canvas 환경에서 HTMLImageElement.drawImage 는 src 없이 실패하므로
// Canvas 를 소스로 사용한다 (node-canvas 는 Canvas 를 drawImage 소스로 수락)
function createDrawableImage(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

// HighResolutionManager.validateProcessingCapability 의 기본 반환값
function makeValidation(overrides: Partial<{ canProcess: boolean; warnings: string[]; estimatedTime: number }> = {}) {
  return {
    canProcess: true,
    analysis: {} as any,
    recommendedStrategy: 'direct' as any,
    warnings: [],
    estimatedTime: 0,
    ...overrides,
  };
}

// HighResolutionManager.smartResize 의 기본 반환값
function makeProcessingResult(overrides: Partial<{ canvas: HTMLCanvasElement }> = {}) {
  return {
    canvas: document.createElement('canvas'),
    analysis: {} as any,
    strategy: 'direct' as any,
    processingTime: 0,
    memoryPeakUsageMB: 0,
    quality: 'balanced' as const,
    ...overrides,
  };
}

// AutoProcessingResult 기본값 생성 헬퍼
function makeAutoProcessingResult(canvas?: HTMLCanvasElement): AutoProcessingResult {
  return {
    canvas: canvas ?? document.createElement('canvas'),
    optimizations: {
      strategy: 'test',
      memoryOptimized: false,
      tileProcessing: false,
      estimatedTimeSaved: 0,
    },
    stats: {
      originalSize: { width: 100, height: 100 },
      finalSize: { width: 50, height: 50 },
      processingTime: 0,
      memoryPeakUsage: 0,
      qualityLevel: 'balanced',
    },
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe('AutoHighResProcessor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // validateProcessing — 임계치 기반 결정
  // --------------------------------------------------------------------------
  describe('validateProcessing', () => {
    beforeEach(() => {
      // validateProcessingCapability 내부 구현(SteppedProcessor 등)을 격리
      vi.spyOn(HighResolutionManager, 'validateProcessingCapability').mockReturnValue(makeValidation());
    });

    it('픽셀 수가 8MP 미만이면 고해상도 권장사항을 반환하지 않는다', () => {
      // 2000×2000 = 4MP < 8MP
      const img = createMockImage(2000, 2000);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

      const hasHighResRec = result.recommendations.some((r) => r.toLowerCase().includes('high-resolution'));
      expect(hasHighResRec).toBe(false);
    });

    it('픽셀 수가 8MP 이상이면 고해상도 권장사항을 반환한다', () => {
      // 3000×3000 = 9MP > 8MP
      const img = createMockImage(3000, 3000);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

      const hasHighResRec = result.recommendations.some((r) => r.toLowerCase().includes('high-resolution'));
      expect(hasHighResRec).toBe(true);
    });

    it('estimatedMemory 가 200MB 미만이면 메모리 경고가 없다', () => {
      // 1000×1000 = 1MP → estimatedMemoryMB ≈ 3.8MB
      const img = createMockImage(1000, 1000);
      const result = AutoHighResProcessor.validateProcessing(img, 500, 500);

      const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory'));
      expect(hasMemWarning).toBe(false);
    });

    it('estimatedMemory 가 200MB 이상이면 메모리 경고가 포함된다', () => {
      // 7300×7300 ≈ 53MP → estimatedMemoryMB ≈ 203MB > 200
      const img = createMockImage(7300, 7300);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

      const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory'));
      expect(hasMemWarning).toBe(true);
    });

    it('validation.estimatedTime 이 10초를 초과하면 처리 시간 경고가 포함된다', () => {
      vi.spyOn(HighResolutionManager, 'validateProcessingCapability').mockReturnValue(
        makeValidation({ estimatedTime: 15 })
      );
      const img = createMockImage(1000, 1000);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

      const hasTimeWarning = result.warnings.some((w) => w.toLowerCase().includes('processing time'));
      expect(hasTimeWarning).toBe(true);
    });

    it('validation.estimatedTime 이 10초 이하면 시간 경고가 없다', () => {
      vi.spyOn(HighResolutionManager, 'validateProcessingCapability').mockReturnValue(
        makeValidation({ estimatedTime: 9 })
      );
      const img = createMockImage(1000, 1000);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

      const hasTimeWarning = result.warnings.some((w) => w.toLowerCase().includes('processing time'));
      expect(hasTimeWarning).toBe(false);
    });

    it('canProcess 는 validation.canProcess 값을 그대로 반영한다', () => {
      vi.spyOn(HighResolutionManager, 'validateProcessingCapability').mockReturnValue(
        makeValidation({ canProcess: false })
      );
      const img = createMockImage(1000, 1000);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

      expect(result.canProcess).toBe(false);
    });

    it('validateProcessing 의 suggestedStrategy 는 balanced 정책 이름이다', () => {
      // validateProcessing 은 내부적으로 priority="balanced" 로 전략을 결정한다
      const img = createMockImage(1000, 1000);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

      expect(result.suggestedStrategy).toBe('Balanced Optimization');
    });

    it('커스텀 highResPixelThreshold 를 낮추면 더 작은 이미지도 고해상도 권장사항을 받는다', () => {
      // 기본 8MP 임계치를 1MP 로 낮춤 → 2.25MP 이미지가 고해상도로 분류
      const img = createMockImage(1500, 1500);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600, {
        thresholds: { highResPixelThreshold: 1_000_000 },
      });

      const hasHighResRec = result.recommendations.some((r) => r.toLowerCase().includes('high-resolution'));
      expect(hasHighResRec).toBe(true);
    });

    it('커스텀 memoryWarningThreshold 를 높이면 같은 이미지에서 메모리 경고가 사라진다', () => {
      // 7300×7300 은 기본(200MB)에서는 경고를 만들지만 500MB 임계치에선 안 만든다
      const img = createMockImage(7300, 7300);
      const result = AutoHighResProcessor.validateProcessing(img, 800, 600, {
        thresholds: { memoryWarningThreshold: 500 },
      });

      const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory'));
      expect(hasMemWarning).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // smartResize — 경로 분기
  // --------------------------------------------------------------------------
  describe('smartResize — 경로 분기', () => {
    let highResSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      highResSpy = vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());
    });

    it('총 픽셀 수가 8MP 미만이면 HighResolutionManager.smartResize 를 호출하지 않는다', async () => {
      // 2000×2000 = 4MP — 표준 경로이므로 drawImage 가 필요 → drawable source
      const img = createDrawableImage(2000, 2000);
      await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(highResSpy).not.toHaveBeenCalled();
    });

    it('총 픽셀 수가 8MP 이상이면 HighResolutionManager.smartResize 를 호출한다', async () => {
      // 3000×3000 = 9MP
      const img = createMockImage(3000, 3000);
      await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(highResSpy).toHaveBeenCalledOnce();
    });

    it('표준 경로(8MP 미만)의 반환 canvas 크기는 targetWidth×targetHeight 다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await AutoHighResProcessor.smartResize(img, 400, 300);

      expect(result.canvas.width).toBe(400);
      expect(result.canvas.height).toBe(300);
    });

    it('priority="quality" 이면 highResOptions.quality 가 "high" 로 전달된다', async () => {
      const img = createMockImage(3000, 3000);
      await AutoHighResProcessor.smartResize(img, 800, 600, { priority: 'quality' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.quality).toBe('high');
    });

    it('priority="speed" 이면 highResOptions.quality 가 "fast" 로 전달된다', async () => {
      const img = createMockImage(3000, 3000);
      await AutoHighResProcessor.smartResize(img, 800, 600, { priority: 'speed' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.quality).toBe('fast');
    });

    it('priority="balanced"(기본) 이면 highResOptions.quality 가 "balanced" 로 전달된다', async () => {
      const img = createMockImage(3000, 3000);
      await AutoHighResProcessor.smartResize(img, 800, 600);

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.quality).toBe('balanced');
    });

    it('커스텀 highResPixelThreshold 를 높이면 9MP 이미지도 표준 경로를 사용한다', async () => {
      // 3000×3000 = 9MP < 20MP 커스텀 임계치 → 표준 경로 → drawable source
      const img = createDrawableImage(3000, 3000);
      await AutoHighResProcessor.smartResize(img, 800, 600, {
        thresholds: { highResPixelThreshold: 20_000_000 },
      });

      expect(highResSpy).not.toHaveBeenCalled();
    });

    it('onProgress 콜백이 전달되면 시작(10)과 완료(100) 진행도로 호출된다', async () => {
      const onProgress = vi.fn();
      const img = createDrawableImage(1000, 1000);
      await AutoHighResProcessor.smartResize(img, 400, 300, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(10, expect.any(String));
      // 전략 결정 단계(20)도 사용자에게 전달되어야 한다
      expect(onProgress).toHaveBeenCalledWith(20, expect.any(String));
      expect(onProgress).toHaveBeenCalledWith(100, expect.any(String));
    });

    it('onMemoryWarning 콜백은 메모리 추정치가 경고 임계치를 넘으면 호출된다', async () => {
      const onMemoryWarning = vi.fn();
      // 7300×7300 ≈ 203MB > 200MB 기본 경고 임계치
      const img = createMockImage(7300, 7300);
      await AutoHighResProcessor.smartResize(img, 800, 600, { onMemoryWarning });

      expect(onMemoryWarning).toHaveBeenCalledOnce();
    });

    it('stats.originalSize 는 소스 이미지 크기를 반영한다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await AutoHighResProcessor.smartResize(img, 400, 300);

      expect(result.stats.originalSize).toEqual({ width: 1000, height: 1000 });
    });

    it('stats.finalSize 는 목표 크기를 반영한다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await AutoHighResProcessor.smartResize(img, 400, 300);

      expect(result.stats.finalSize).toEqual({ width: 400, height: 300 });
    });

    it('고해상도 처리 실패 시 표준 처리로 폴백해 canvas 를 반환한다', async () => {
      // beforeEach 의 mockResolvedValue 를 reject 로 덮어씀
      highResSpy.mockRejectedValue(new Error('GPU 오류'));
      // 커스텀 임계치(0.1MP)로 drawable canvas 800×600(0.48MP)를 고해상도로 분류 → try 블록 진입
      // HighResolutionManager.smartResize 가 throw → catch 블록 → standardResize 폴백
      const img = createDrawableImage(800, 600);
      const result = await AutoHighResProcessor.smartResize(img, 400, 300, {
        thresholds: { highResPixelThreshold: 100_000 },
      });
      expect(result.canvas.width).toBe(400);
      expect(result.canvas.height).toBe(300);
    });

    it('고해상도 처리 실패 시 onProgress 는 50으로 폴백 안내를 호출한다', async () => {
      highResSpy.mockRejectedValue(new Error('GPU 오류'));
      const onProgress = vi.fn();
      const img = createDrawableImage(800, 600);
      await AutoHighResProcessor.smartResize(img, 400, 300, {
        thresholds: { highResPixelThreshold: 100_000 },
        onProgress,
      });
      // catch 블록: onProgress(50, 'Changing processing method...')
      expect(onProgress).toHaveBeenCalledWith(50, expect.any(String));
    });
  });

  // --------------------------------------------------------------------------
  // smartResize — autoTileThreshold(300MB) 분기
  // --------------------------------------------------------------------------
  describe('smartResize — autoTileThreshold(300MB) 분기', () => {
    beforeEach(() => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());
    });

    it('estimatedMemoryMB 가 autoTileThreshold(300MB) 초과이면 balanced 전략은 tileProcessing=true 를 반환한다', async () => {
      // 8870×8870 ≈ 78.6MP → estimatedMemoryMB ≈ 300.12MB > 300MB (autoTileThreshold)
      // isHighMem=true → memoryOptimized=true, tileProcessing=true
      const img = createMockImage(8870, 8870);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600);
      expect(result.optimizations.tileProcessing).toBe(true);
      expect(result.optimizations.memoryOptimized).toBe(true);
    });

    it('estimatedMemoryMB 가 autoTileThreshold(300MB) 미만이면 balanced 전략은 tileProcessing=false 를 반환한다', async () => {
      // 7300×7300 ≈ 203MB < 300MB → isHighMem=false → memoryOptimized=false
      const img = createMockImage(7300, 7300);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600);
      expect(result.optimizations.tileProcessing).toBe(false);
      expect(result.optimizations.memoryOptimized).toBe(false);
      // isHighRes=true 이지만 memoryOptimized=false 이므로 userMessage 는 undefined 여야 한다
      // `if (isHighRes || strategy.memoryOptimized)` 로 회귀하면 이 단정이 실패한다
      expect(result.userMessage).toBeUndefined();
    });

    it('isHighRes && memoryOptimized 이면 userMessage 가 설정된다', async () => {
      // 8870×8870: totalPixels ≈ 78.6MP > 8MP(isHighRes=true), estimatedMemoryMB ≈ 300.12MB > 300MB(isHighMem=true)
      // → balanced 전략의 memoryOptimized=true → userMessage 포함
      const img = createMockImage(8870, 8870);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600);
      expect(result.userMessage).toBeDefined();
      expect(result.userMessage).toContain('memory');
    });

    it('커스텀 autoTileThreshold 로 임계치 초과를 검증한다: tileProcessing=true', async () => {
      // 3000×3000 ≈ 34.3MB > 커스텀 임계치 30MB → isHighMem=true
      const img = createMockImage(3000, 3000);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600, {
        thresholds: { autoTileThreshold: 30 },
      });
      expect(result.optimizations.tileProcessing).toBe(true);
    });

    it('커스텀 autoTileThreshold 로 임계치 미달을 검증한다: tileProcessing=false', async () => {
      // 3000×3000 ≈ 34.3MB < 커스텀 임계치 40MB → isHighMem=false
      const img = createMockImage(3000, 3000);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600, {
        thresholds: { autoTileThreshold: 40 },
      });
      expect(result.optimizations.tileProcessing).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // smartResize — 가로/세로 극단 케이스
  // --------------------------------------------------------------------------
  describe('smartResize — 극단적 종횡비', () => {
    beforeEach(() => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());
    });

    it('매우 넓은 이미지(10000×100)는 픽셀 수 1MP → 표준 경로를 사용한다', async () => {
      const highResSpy = vi.spyOn(HighResolutionManager, 'smartResize');
      const img = createDrawableImage(10000, 100);
      await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(highResSpy).not.toHaveBeenCalled();
    });

    it('매우 높은 이미지(100×10000)는 픽셀 수 1MP → 표준 경로를 사용한다', async () => {
      const highResSpy = vi.spyOn(HighResolutionManager, 'smartResize');
      const img = createDrawableImage(100, 10000);
      await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(highResSpy).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // smartResize — 폴백 진행도 순서
  // --------------------------------------------------------------------------
  describe('smartResize — 폴백 진행도 순서', () => {
    it('폴백 실패 시 onProgress(50) 이후 onProgress(100) 이 순서대로 호출된다', async () => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockRejectedValue(new Error('GPU 오류'));
      const onProgress = vi.fn();
      // drawable canvas + highResPixelThreshold=100_000 으로 고해상도 경로 진입 후 reject
      const img = createDrawableImage(800, 600);
      await AutoHighResProcessor.smartResize(img, 400, 300, {
        thresholds: { highResPixelThreshold: 100_000 },
        onProgress,
      });
      const progressValues = onProgress.mock.calls.map((args) => args[0] as number);
      const idx50 = progressValues.indexOf(50);
      const idx100 = progressValues.lastIndexOf(100);
      // 50 이후 100 이 순서대로 호출되어야 한다
      expect(idx50).toBeGreaterThanOrEqual(0);
      expect(idx100).toBeGreaterThan(idx50);
    });
  });

  // --------------------------------------------------------------------------
  // smartResize — onMemoryWarning 미호출 경로
  // --------------------------------------------------------------------------
  describe('smartResize — onMemoryWarning 미호출', () => {
    it('메모리 추정치가 임계치 미만이면 onMemoryWarning 이 호출되지 않는다', async () => {
      // 1000×1000 ≈ 3.8MB < 200MB 기본 임계치 → 경고 없음
      const onMemoryWarning = vi.fn();
      const img = createDrawableImage(1000, 1000);
      await AutoHighResProcessor.smartResize(img, 400, 300, { onMemoryWarning });
      expect(onMemoryWarning).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // smartResizeWithProgress (convenience 함수)
  // --------------------------------------------------------------------------
  describe('smartResizeWithProgress (convenience 함수)', () => {
    beforeEach(() => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());
    });

    it('AutoProcessingResult 전체(canvas, optimizations, stats)를 반환한다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await smartResizeWithProgress(img, 400, 300, vi.fn());
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('optimizations');
      expect(result).toHaveProperty('stats');
    });

    it('progress callback 이 진행도와 함께 호출된다', async () => {
      const onProgress = vi.fn();
      const img = createDrawableImage(1000, 1000);
      await smartResizeWithProgress(img, 400, 300, onProgress);
      expect(onProgress).toHaveBeenCalledWith(10, expect.any(String));
      expect(onProgress).toHaveBeenCalledWith(100, expect.any(String));
    });
  });

  // --------------------------------------------------------------------------
  // smartResize (convenience 함수) — canvas 만 반환
  // --------------------------------------------------------------------------
  describe('smartResize (convenience 함수)', () => {
    it('AutoProcessingResult.canvas 만 반환한다 (HTMLCanvasElement)', async () => {
      const mockCanvas = document.createElement('canvas');
      vi.spyOn(AutoHighResProcessor, 'smartResize').mockResolvedValue(makeAutoProcessingResult(mockCanvas));
      const img = createMockImage(1000, 1000);
      const result = await smartResize(img, 400, 300);
      expect(result).toBe(mockCanvas);
      expect(result).toBeInstanceOf(HTMLCanvasElement);
    });
  });

  // --------------------------------------------------------------------------
  // batchSmartResize
  // --------------------------------------------------------------------------
  describe('batchSmartResize', () => {
    it('결과 배열이 입력 이미지 순서를 유지한다', async () => {
      // 호출 순서대로 고유한 canvas 를 반환해 결과 인덱스 매핑을 추적한다
      let callCount = 0;
      vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = ++callCount * 100;
        return makeAutoProcessingResult(canvas);
      });

      const images = [
        { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'img0' },
        { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'img1' },
        { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'img2' },
      ];

      // concurrency=1 로 순서를 결정적으로 유지
      const results = await AutoHighResProcessor.batchSmartResize(images, { concurrency: 1 });

      expect(results).toHaveLength(3);
      expect(results[0].canvas.width).toBe(100);
      expect(results[1].canvas.width).toBe(200);
      expect(results[2].canvas.width).toBe(300);
    });

    it('onProgress 에 완료 수, 전체 수, 이름을 순서대로 전달한다', async () => {
      vi.spyOn(AutoHighResProcessor, 'smartResize').mockResolvedValue(makeAutoProcessingResult());

      const onProgress = vi.fn();
      const images = [
        { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'alpha' },
        { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'beta' },
      ];

      await AutoHighResProcessor.batchSmartResize(images, { concurrency: 1, onProgress });

      expect(onProgress).toHaveBeenCalledWith(1, 2, 'alpha');
      expect(onProgress).toHaveBeenCalledWith(2, 2, 'beta');
    });

    it('onImageComplete 에 글로벌 인덱스와 결과를 전달한다', async () => {
      vi.spyOn(AutoHighResProcessor, 'smartResize').mockResolvedValue(makeAutoProcessingResult());

      const onImageComplete = vi.fn();
      const images = [
        { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'alpha' },
        { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'beta' },
      ];

      await AutoHighResProcessor.batchSmartResize(images, { concurrency: 1, onImageComplete });

      expect(onImageComplete).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ canvas: expect.any(HTMLCanvasElement) })
      );
      expect(onImageComplete).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ canvas: expect.any(HTMLCanvasElement) })
      );
    });

    // concurrency=2: chunk 내부 Promise.all 에서 완료 순서가 입력 순서와 달라질 때
    // results[globalIndex] = result 계약과 globalIndex 계산식을 모두 검증한다.

    it('concurrency=2 환경에서 beta 가 먼저 완료돼도 결과 배열은 입력 순서(alpha→beta)를 유지한다', async () => {
      const imgAlpha = createMockImage(100, 100);
      const imgBeta = createMockImage(100, 100);
      const alphaCanvas = document.createElement('canvas');
      alphaCanvas.width = 111;
      const betaCanvas = document.createElement('canvas');
      betaCanvas.width = 222;

      vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
        if (img === imgAlpha) {
          // alpha 를 30ms 지연시켜 beta 가 먼저 완료되도록 유도
          await new Promise<void>((resolve) => setTimeout(resolve, 30));
          return makeAutoProcessingResult(alphaCanvas);
        }
        return makeAutoProcessingResult(betaCanvas);
      });

      const images = [
        { img: imgAlpha, targetWidth: 50, targetHeight: 50, name: 'alpha' },
        { img: imgBeta, targetWidth: 50, targetHeight: 50, name: 'beta' },
      ];

      const results = await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2 });

      // beta 가 먼저 완료됐어도 results[0] = alpha, results[1] = beta 여야 한다
      expect(results[0].canvas.width).toBe(111);
      expect(results[1].canvas.width).toBe(222);
    });

    it('concurrency=2 환경에서 onImageComplete 는 완료 순서와 무관하게 globalIndex 를 올바르게 전달한다', async () => {
      const imgAlpha = createMockImage(100, 100);
      const imgBeta = createMockImage(100, 100);
      const alphaCanvas = document.createElement('canvas');
      alphaCanvas.width = 111;
      const betaCanvas = document.createElement('canvas');
      betaCanvas.width = 222;

      vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
        if (img === imgAlpha) {
          await new Promise<void>((resolve) => setTimeout(resolve, 30));
          return makeAutoProcessingResult(alphaCanvas);
        }
        return makeAutoProcessingResult(betaCanvas);
      });

      const onImageComplete = vi.fn();
      const images = [
        { img: imgAlpha, targetWidth: 50, targetHeight: 50, name: 'alpha' },
        { img: imgBeta, targetWidth: 50, targetHeight: 50, name: 'beta' },
      ];

      await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2, onImageComplete });

      // beta 가 먼저 완료돼도 globalIndex 0 = alpha, globalIndex 1 = beta 여야 한다
      expect(onImageComplete).toHaveBeenCalledWith(0, expect.objectContaining({ canvas: alphaCanvas }));
      expect(onImageComplete).toHaveBeenCalledWith(1, expect.objectContaining({ canvas: betaCanvas }));
    });

    it('한 항목이 처리 실패하면 전체 batchSmartResize Promise 가 reject 된다', async () => {
      // catch 블록이 silent swallow 로 바뀌거나 제거되면 이 테스트가 실패한다
      vi.spyOn(AutoHighResProcessor, 'smartResize').mockRejectedValue(new Error('처리 실패'));

      const images = [{ img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'img0' }];

      await expect(AutoHighResProcessor.batchSmartResize(images, { concurrency: 1 })).rejects.toThrow('처리 실패');
    });

    // ----- globalIndex 곱셈 계산 검증: 2 chunk 이상 케이스 -----
    // globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex
    // 단일 chunk(이미지 수 ≤ concurrency)에서는 곱셈항이 항상 0이라 회귀를 잡지 못한다.
    // 3장·4장 케이스는 두 번째 chunk 를 만들어 곱셈항을 강제로 활성화한다.

    it('concurrency=2 + 3장: 두 번째 chunk 의 globalIndex 가 concurrency(=2) 여야 한다', async () => {
      // chunk[0]=[img0,img1], chunk[1]=[img2]
      // img2 의 globalIndex: 정상=1*2+0=2, 버그(곱셈 누락)=1+0=1 → results[1] 덮어씀
      const imgs = [0, 1, 2].map(() => createMockImage(100, 100));
      const resultCanvases = [0, 1, 2].map((i) => {
        const c = document.createElement('canvas');
        c.width = (i + 1) * 100; // 100, 200, 300
        return c;
      });

      vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
        const imgIndex = imgs.indexOf(img as HTMLImageElement);
        return makeAutoProcessingResult(resultCanvases[imgIndex]);
      });

      const onImageComplete = vi.fn();
      const images = imgs.map((img, i) => ({ img, targetWidth: 50, targetHeight: 50, name: `img${i}` }));
      const results = await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2, onImageComplete });

      // results 순서: img0→100, img1→200, img2→300
      expect(results).toHaveLength(3);
      expect(results[0].canvas.width).toBe(100);
      expect(results[1].canvas.width).toBe(200);
      expect(results[2].canvas.width).toBe(300);

      // onImageComplete 에 전달된 globalIndex 도 정확해야 한다
      expect(onImageComplete).toHaveBeenCalledWith(0, expect.objectContaining({ canvas: resultCanvases[0] }));
      expect(onImageComplete).toHaveBeenCalledWith(1, expect.objectContaining({ canvas: resultCanvases[1] }));
      expect(onImageComplete).toHaveBeenCalledWith(2, expect.objectContaining({ canvas: resultCanvases[2] }));
    });

    it('concurrency=2 + 4장: 두 번째 chunk 가 꽉 찬 경우 globalIndex 3까지 정확히 매핑된다', async () => {
      // chunk[0]=[img0,img1], chunk[1]=[img2,img3]
      // img2 globalIndex=2, img3 globalIndex=3 을 검증한다
      const imgs = [0, 1, 2, 3].map(() => createMockImage(100, 100));
      const resultCanvases = [0, 1, 2, 3].map((i) => {
        const c = document.createElement('canvas');
        c.width = (i + 1) * 100; // 100, 200, 300, 400
        return c;
      });

      vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
        const imgIndex = imgs.indexOf(img as HTMLImageElement);
        return makeAutoProcessingResult(resultCanvases[imgIndex]);
      });

      const onImageComplete = vi.fn();
      const images = imgs.map((img, i) => ({ img, targetWidth: 50, targetHeight: 50, name: `img${i}` }));
      const results = await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2, onImageComplete });

      expect(results).toHaveLength(4);
      expect(results[0].canvas.width).toBe(100);
      expect(results[1].canvas.width).toBe(200);
      expect(results[2].canvas.width).toBe(300);
      expect(results[3].canvas.width).toBe(400);

      expect(onImageComplete).toHaveBeenCalledWith(2, expect.objectContaining({ canvas: resultCanvases[2] }));
      expect(onImageComplete).toHaveBeenCalledWith(3, expect.objectContaining({ canvas: resultCanvases[3] }));
    });

    it('concurrency=2 환경에서 onProgress 마지막 호출은 전체 완료 수와 마지막 완료 이름을 전달한다', async () => {
      const imgAlpha = createMockImage(100, 100);
      const imgBeta = createMockImage(100, 100);

      vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
        if (img === imgAlpha) {
          // alpha 가 늦게 완료 → 마지막 onProgress 호출 이름은 'alpha'
          await new Promise<void>((resolve) => setTimeout(resolve, 30));
        }
        return makeAutoProcessingResult();
      });

      const onProgress = vi.fn();
      const images = [
        { img: imgAlpha, targetWidth: 50, targetHeight: 50, name: 'alpha' },
        { img: imgBeta, targetWidth: 50, targetHeight: 50, name: 'beta' },
      ];

      await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2, onProgress });

      // beta 먼저 완료: onProgress(1, 2, 'beta'), alpha 나중 완료: onProgress(2, 2, 'alpha')
      const calls = onProgress.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe(2); // completed = total
      expect(lastCall[1]).toBe(2); // total
      expect(lastCall[2]).toBe('alpha'); // 마지막으로 완료된 항목 (지연된 alpha)
    });
  });
});
