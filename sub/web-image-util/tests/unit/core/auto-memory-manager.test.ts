/**
 * AutoMemoryManager 단위 테스트
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { AutoMemoryManager } from '../../../src/core/auto-memory-manager.internal';

describe('AutoMemoryManager', () => {
  let manager: AutoMemoryManager;

  beforeEach(() => {
    manager = AutoMemoryManager.getInstance();
    manager.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
