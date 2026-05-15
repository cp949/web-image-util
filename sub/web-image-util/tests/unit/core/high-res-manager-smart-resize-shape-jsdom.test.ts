/**
 * HighResolutionManager.smartResize 의 비전략(non-strategy) 행동 테스트
 *
 * - 반환 객체 형태와 quality 옵션 전달
 * - 진행률(onProgress) 콜백 분기
 * - 메모리 경고(onMemoryWarning) 콜백 분기
 *
 * DIRECT 경로는 jsdom+canvas 에서 drawImage 가 동작하는 canvas 기반 소스를 사용한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessingStrategy } from '../../../src/base/high-res-detector';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { createDrawableImage } from './high-res-manager-helpers';

describe('HighResolutionManager.smartResize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 반환 형태와 quality 전달
  // --------------------------------------------------------------------------
  describe('반환 형태와 quality 전달', () => {
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
  // 진행률 콜백
  // --------------------------------------------------------------------------
  describe('진행률 콜백', () => {
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
  // onMemoryWarning 콜백
  // --------------------------------------------------------------------------
  // jsdom 환경에는 performance.memory 가 없으므로 getEstimatedUsage()가
  // 폴백 값(used=64MB, limit=512MB)을 반환한다 → availableMB ≈ 448MB.
  // 따라서 maxMemoryUsageMB 를 448 보다 크게/작게 주면 발화 분기를 강제할 수 있다.
  describe('onMemoryWarning 콜백', () => {
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
});
