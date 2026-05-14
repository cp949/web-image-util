/**
 * AutoHighResProcessor 단위 테스트
 *
 * validateProcessing 의 임계치 기반 결정 로직과
 * smartResize 의 표준/고해상도 경로 분기를 검증한다.
 * HighResolutionManager 의 실제 렌더링 호출은 spy 로 격리한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { AutoHighResProcessor } from '../../../src/core/auto-high-res';

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
      // 7300×7300 ≈ 203MB < 300MB → isHighMem=false
      const img = createMockImage(7300, 7300);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600);
      expect(result.optimizations.tileProcessing).toBe(false);
      expect(result.optimizations.memoryOptimized).toBe(false);
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
});
