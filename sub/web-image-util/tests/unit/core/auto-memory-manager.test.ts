/**
 * AutoMemoryManager 단위 테스트
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool';
import { AutoMemoryManager } from '../../../src/core/auto-memory-manager';

describe('AutoMemoryManager', () => {
  let manager: AutoMemoryManager;

  beforeEach(() => {
    manager = AutoMemoryManager.getInstance();
    manager.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('estimateImageMemoryUsage', () => {
    it('100×100 이미지의 메모리 사용량을 MB 단위로 추정한다', () => {
      // RGBA 4바이트, Canvas 처리 오버헤드 2배 적용
      // (100 * 100 * 4) / (1024*1024) * 2 ≈ 0.076MB → Math.round → 0
      const result = manager.estimateImageMemoryUsage(100, 100);
      expect(result).toBe(0);
    });

    it('1000×1000 이미지의 메모리 사용량을 MB 단위로 추정한다', () => {
      // (1000 * 1000 * 4) / (1024*1024) * 2 ≈ 7.63MB → Math.round → 8
      const result = manager.estimateImageMemoryUsage(1000, 1000);
      expect(result).toBe(8);
    });

    it('4000×3000 이미지(12MP)의 사용량을 계산한다', () => {
      // (4000 * 3000 * 4) / (1024*1024) * 2 ≈ 91.55MB → Math.round → 92
      const result = manager.estimateImageMemoryUsage(4000, 3000);
      expect(result).toBe(92);
    });
  });

  describe('canProcessLargeImage', () => {
    it('추정 메모리가 90% 한도 이내면 true를 반환한다', () => {
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.5,
        availableMB: 256,
        usedMB: 256,
        limitMB: 512,
      });

      // usedMB(256) + estimatedMB(50) = 306 / 512 = 0.598 < 0.9
      expect(manager.canProcessLargeImage(50)).toBe(true);
    });

    it('추정 메모리가 90% 한도를 초과하면 false를 반환한다', () => {
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.8,
        availableMB: 100,
        usedMB: 400,
        limitMB: 500,
      });

      // usedMB(400) + estimatedMB(100) = 500 / 500 = 1.0 >= 0.9
      expect(manager.canProcessLargeImage(100)).toBe(false);
    });
  });

  describe('recommendProcessingStrategy', () => {
    // tiled/chunked/direct 테스트에서 공통으로 쓰는 낮은 압박 mock
    beforeEach(() => {
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.3,
        availableMB: 350,
        usedMB: 150,
        limitMB: 500,
      });
    });

    it('메모리 압박이 높으면 memory-efficient를 반환한다', () => {
      // 이 테스트는 beforeEach mock을 덮어씀
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.75,
        availableMB: 128,
        usedMB: 384,
        limitMB: 512,
      });

      const strategy = manager.recommendProcessingStrategy(2000, 2000, 800, 600);
      expect(strategy).toBe('memory-efficient');
    });

    it('16MP 초과 이미지에는 tiled를 반환한다', () => {
      // 4096×4096 = 16,777,216 > 16,000,000
      const strategy = manager.recommendProcessingStrategy(4096, 4096, 1920, 1080);
      expect(strategy).toBe('tiled');
    });

    it('4~16MP 이미지에는 chunked를 반환한다', () => {
      // 2560×1600 = 4,096,000 > 4,000,000
      const strategy = manager.recommendProcessingStrategy(2560, 1600, 800, 500);
      expect(strategy).toBe('chunked');
    });

    it('4MP 이하 이미지에는 direct를 반환한다', () => {
      // 1920×1080 = 2,073,600 < 4,000,000
      const strategy = manager.recommendProcessingStrategy(1920, 1080, 800, 450);
      expect(strategy).toBe('direct');
    });
  });

  describe('checkAndOptimize', () => {
    it('메모리 압박이 낮으면 CanvasPool.clear를 호출하지 않는다', async () => {
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.5,
        availableMB: 256,
        usedMB: 256,
        limitMB: 512,
      });
      const clearSpy = vi.spyOn(CanvasPool.getInstance(), 'clear').mockImplementation(() => {});

      await manager.checkAndOptimize();

      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('메모리 압박이 80% 초과면 CanvasPool.clear를 호출한다', async () => {
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.85,
        availableMB: 75,
        usedMB: 425,
        limitMB: 500,
      });
      const clearSpy = vi.spyOn(CanvasPool.getInstance(), 'clear').mockImplementation(() => {});

      await manager.checkAndOptimize();

      expect(clearSpy).toHaveBeenCalledOnce();
    });

    it('5초 이내 재호출 시에는 CanvasPool.clear를 다시 호출하지 않는다', async () => {
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.85,
        availableMB: 75,
        usedMB: 425,
        limitMB: 500,
      });
      const clearSpy = vi.spyOn(CanvasPool.getInstance(), 'clear').mockImplementation(() => {});

      await manager.checkAndOptimize();
      await manager.checkAndOptimize(); // 즉시 재호출

      expect(clearSpy).toHaveBeenCalledOnce(); // 두 번째는 skip
    });
  });

  describe('reset / getOptimizationStats', () => {
    it('reset 후 optimizationCount가 0으로 초기화된다', async () => {
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.85,
        availableMB: 75,
        usedMB: 425,
        limitMB: 500,
      });
      vi.spyOn(CanvasPool.getInstance(), 'clear').mockImplementation(() => {});

      await manager.checkAndOptimize();
      expect(manager.getOptimizationStats().optimizationCount).toBe(1);

      manager.reset();
      expect(manager.getOptimizationStats().optimizationCount).toBe(0);
    });

    it('reset 후 lastOptimizationTime이 0으로 초기화된다', async () => {
      vi.spyOn(manager, 'getMemoryInfo').mockReturnValue({
        pressure: 0.85,
        availableMB: 75,
        usedMB: 425,
        limitMB: 500,
      });
      vi.spyOn(CanvasPool.getInstance(), 'clear').mockImplementation(() => {});

      await manager.checkAndOptimize();
      expect(manager.getOptimizationStats().lastOptimizationTime).toBeGreaterThan(0);

      manager.reset();
      expect(manager.getOptimizationStats().lastOptimizationTime).toBe(0);
    });
  });
});
