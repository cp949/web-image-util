/**
 * Automatic memory manager - Transparent memory optimization
 *
 * @description Automatically checks memory status and optimizes
 * so users don't need to worry about memory management.
 */

import { CanvasPool } from '../base/canvas-pool.internal';
import { type MemoryBudget, readMemoryBudget, requestMemoryRelief } from '../utils/browser-capabilities/index';
import { debugLog, productionLog } from '../utils/debug.internal';

/**
 * Automatic memory manager - Singleton pattern
 *
 * Automatically optimizes internally so users
 * don't need to worry about memory management.
 */
export class AutoMemoryManager {
  private static instance: AutoMemoryManager;
  private lastOptimizationTime = 0;
  private optimizationCount = 0;

  static getInstance(): AutoMemoryManager {
    if (!AutoMemoryManager.instance) {
      AutoMemoryManager.instance = new AutoMemoryManager();
    }
    return AutoMemoryManager.instance;
  }

  /**
   * Automatic memory status check and response
   * Automatically perform optimization in high pressure situations
   */
  async checkAndOptimize(): Promise<void> {
    const memoryInfo = this.getMemoryInfo();

    // Auto-optimize when memory pressure is 80% or above
    if (memoryInfo.pressure > 0.8) {
      await this.performOptimization(memoryInfo);
    }
  }

  /**
   * Perform memory optimization
   */
  private async performOptimization(memoryInfo: MemoryBudget): Promise<void> {
    const now = Date.now();

    // Skip if optimization was performed within the last 5 seconds (prevent too frequent execution)
    if (now - this.lastOptimizationTime < 5000) {
      return;
    }

    this.lastOptimizationTime = now;
    this.optimizationCount++;

    try {
      // 1. Clean up Canvas Pool
      const canvasPool = CanvasPool.getInstance();
      // Clean up if Canvas Pool is not empty (access internal pool array)
      canvasPool.clear();
      debugLog.debug('[AutoMemoryManager] Canvas pool cleared due to memory pressure');

      // 2. Trigger garbage collection (in Node.js environment)
      if (requestMemoryRelief()) {
        debugLog.debug('[AutoMemoryManager] Garbage collection triggered');
      }

      // 3. Log memory pressure situation in browser environment
      if (typeof console !== 'undefined' && memoryInfo.pressure > 0.9) {
        productionLog.warn(
          `[AutoMemoryManager] High memory pressure: ${Math.round(memoryInfo.pressure * 100)}% ` +
            `(${memoryInfo.usedMB}MB / ${memoryInfo.limitMB}MB)`
        );
      }
    } catch (error) {
      productionLog.error('[AutoMemoryManager] Optimization failed:', error);
    }
  }

  /**
   * Query current memory information
   *
   * 메모리 예산은 browser-capabilities/memory.internal.ts가 단일 소유한다. 이 파일의
   * 기존 usedMB/limitMB를 유지하고, 모순이던 availableMB/pressure는 두 값에서 유도한
   * 정합값으로 통일했다.
   */
  getMemoryInfo(): MemoryBudget {
    return readMemoryBudget();
  }

  /**
   * Query optimization statistics (for debugging)
   */
  getOptimizationStats() {
    return {
      optimizationCount: this.optimizationCount,
      lastOptimizationTime: this.lastOptimizationTime,
      memoryInfo: this.getMemoryInfo(),
    };
  }

  /**
   * Reset memory manager (for testing)
   */
  reset(): void {
    this.optimizationCount = 0;
    this.lastOptimizationTime = 0;
  }
}
