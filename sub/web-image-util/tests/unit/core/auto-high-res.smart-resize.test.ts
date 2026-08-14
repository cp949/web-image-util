/**
 * AutoHighResProcessor.smartResize 의 표준/고해상도 경로 분기와 진행도 콜백을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { AutoHighResProcessor } from '../../../src/core/auto-high-res';
import { createDrawableImage, createMockImage, makeProcessingResult } from './auto-high-res.helpers';

describe('AutoHighResProcessor.smartResize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('경로 분기', () => {
    let highResSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      highResSpy = vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());
    });

    it('총 픽셀 수가 8MP 미만이면 HighResolutionManager.smartResize 를 호출하지 않는다', async () => {
      const img = createDrawableImage(2000, 2000);
      await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(highResSpy).not.toHaveBeenCalled();
    });

    it('총 픽셀 수가 8MP 이상이면 HighResolutionManager.smartResize 를 호출한다', async () => {
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
      // target 을 1000×1000 으로 둬 scaleRatio(=3000/1000=3)가 게이트 임계치(4)를 넘지 않게 한다.
      // 800×600 target 이면 scaleRatio(=5)가 4를 넘어 픽셀 임계값 override 와 무관하게
      // 고해상도 경로로 빠지므로, 이 테스트가 검증하려는 "픽셀 임계값 override" 의도가 가려진다.
      const img = createDrawableImage(3000, 3000);
      await AutoHighResProcessor.smartResize(img, 1000, 1000, {
        thresholds: { highResPixelThreshold: 20_000_000 },
      });

      expect(highResSpy).not.toHaveBeenCalled();
    });

    it('onProgress 콜백이 전달되면 시작(10)과 완료(100) 진행도로 호출된다', async () => {
      const onProgress = vi.fn();
      const img = createDrawableImage(1000, 1000);
      await AutoHighResProcessor.smartResize(img, 400, 300, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(10, expect.any(String));
      expect(onProgress).toHaveBeenCalledWith(20, expect.any(String));
      expect(onProgress).toHaveBeenCalledWith(100, expect.any(String));
    });

    it('onMemoryWarning 콜백은 메모리 추정치가 경고 임계치를 넘으면 호출된다', async () => {
      const onMemoryWarning = vi.fn();
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
      highResSpy.mockRejectedValue(new Error('GPU 오류'));
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

      expect(onProgress).toHaveBeenCalledWith(50, expect.any(String));
    });
  });

  describe('autoTileThreshold(300MB) 분기', () => {
    beforeEach(() => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());
    });

    it('estimatedMemoryMB 가 autoTileThreshold(300MB) 초과이면 balanced 전략은 tileProcessing=true 를 반환한다', async () => {
      const img = createMockImage(8870, 8870);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(result.optimizations.tileProcessing).toBe(true);
      expect(result.optimizations.memoryOptimized).toBe(true);
    });

    it('estimatedMemoryMB 가 autoTileThreshold(300MB) 미만이면 balanced 전략은 tileProcessing=false 를 반환한다', async () => {
      const img = createMockImage(7300, 7300);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(result.optimizations.tileProcessing).toBe(false);
      expect(result.optimizations.memoryOptimized).toBe(false);
      expect(result.userMessage).toBeUndefined();
    });

    it('isHighRes && memoryOptimized 이면 userMessage 가 설정된다', async () => {
      const img = createMockImage(8870, 8870);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(result.userMessage).toBeDefined();
      expect(result.userMessage).toContain('memory');
    });

    it('커스텀 autoTileThreshold 로 임계치 초과를 검증한다: tileProcessing=true', async () => {
      const img = createMockImage(3000, 3000);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600, {
        thresholds: { autoTileThreshold: 30 },
      });

      expect(result.optimizations.tileProcessing).toBe(true);
    });

    it('커스텀 autoTileThreshold 로 임계치 미달을 검증한다: tileProcessing=false', async () => {
      const img = createMockImage(3000, 3000);
      const result = await AutoHighResProcessor.smartResize(img, 800, 600, {
        thresholds: { autoTileThreshold: 40 },
      });

      expect(result.optimizations.tileProcessing).toBe(false);
    });
  });

  describe('극단적 종횡비', () => {
    beforeEach(() => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());
    });

    it('매우 넓은 이미지(10000×100)는 스케일 비율이 4를 초과해 고해상도 경로를 사용한다(게이트 통합 — scaleRatio 조건 신설)', async () => {
      // 10000×100 = 1MP(8MP 미만)이지만 800×600 목표 대비 스케일 max(10000/800, 100/600) = 12.5 > 4
      // SmartProcessor와 게이트를 공유하며 AutoHighResProcessor 도 scaleRatio 조건을 새로 갖는다
      const highResSpy = vi.spyOn(HighResolutionManager, 'smartResize');
      const img = createDrawableImage(10000, 100);
      await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(highResSpy).toHaveBeenCalledOnce();
    });

    it('매우 높은 이미지(100×10000)는 스케일 비율이 4를 초과해 고해상도 경로를 사용한다(게이트 통합 — scaleRatio 조건 신설)', async () => {
      // 100×10000 = 1MP(8MP 미만)이지만 800×600 목표 대비 스케일 max(100/800, 10000/600) = 16.67 > 4
      const highResSpy = vi.spyOn(HighResolutionManager, 'smartResize');
      const img = createDrawableImage(100, 10000);
      await AutoHighResProcessor.smartResize(img, 800, 600);

      expect(highResSpy).toHaveBeenCalledOnce();
    });
  });

  describe('폴백 진행도 순서', () => {
    it('폴백 실패 시 onProgress(50) 이후 onProgress(100) 이 순서대로 호출된다', async () => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockRejectedValue(new Error('GPU 오류'));
      const onProgress = vi.fn();
      const img = createDrawableImage(800, 600);
      await AutoHighResProcessor.smartResize(img, 400, 300, {
        thresholds: { highResPixelThreshold: 100_000 },
        onProgress,
      });

      const progressValues = onProgress.mock.calls.map((args) => args[0] as number);
      const idx50 = progressValues.indexOf(50);
      const idx100 = progressValues.lastIndexOf(100);
      expect(idx50).toBeGreaterThanOrEqual(0);
      expect(idx100).toBeGreaterThan(idx50);
    });
  });

  describe('onMemoryWarning 미호출', () => {
    it('메모리 추정치가 임계치 미만이면 onMemoryWarning 이 호출되지 않는다', async () => {
      const onMemoryWarning = vi.fn();
      const img = createDrawableImage(1000, 1000);
      await AutoHighResProcessor.smartResize(img, 400, 300, { onMemoryWarning });

      expect(onMemoryWarning).not.toHaveBeenCalled();
    });
  });
});
