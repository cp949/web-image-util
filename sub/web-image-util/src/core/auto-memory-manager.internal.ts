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
   * 메모리 예산은 browser-capabilities/memory.internal.ts가 단일 소유한다. 이 파일이
   * 쓰던 shape·fallback 값이 그대로 그 모듈의 정본으로 승격됐다.
   */
  getMemoryInfo(): MemoryBudget {
    return readMemoryBudget();
  }

  /**
   * Check if memory state is suitable for image processing
   */
  canProcessLargeImage(estimatedUsageMB: number): boolean {
    const memoryInfo = this.getMemoryInfo();

    // Ensure current pressure + estimated usage doesn't exceed 90%
    const projectedPressure = (memoryInfo.usedMB + estimatedUsageMB) / memoryInfo.limitMB;

    return projectedPressure < 0.9;
  }

  /**
   * Calculate estimated memory usage based on image size
   */
  estimateImageMemoryUsage(width: number, height: number): number {
    // 4 channels (RGBA) * 4 bytes + some overhead
    const baseUsage = (width * height * 4) / (1024 * 1024);

    // Canvas processing overhead (approximately 2x)
    return Math.round(baseUsage * 2);
  }

  /**
   * Recommend appropriate processing strategy
   */
  recommendProcessingStrategy(
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number
  ): 'direct' | 'chunked' | 'tiled' | 'memory-efficient' {
    const memoryInfo = this.getMemoryInfo();
    const estimatedUsage = this.estimateImageMemoryUsage(originalWidth, originalHeight);

    // Memory pressure situation
    if (memoryInfo.pressure > 0.7 || !this.canProcessLargeImage(estimatedUsage)) {
      return 'memory-efficient';
    }

    // Image size-based strategy
    const pixelCount = originalWidth * originalHeight;

    if (pixelCount > 16_000_000) {
      return 'tiled';
    } else if (pixelCount > 4_000_000) {
      return 'chunked';
    } else {
      return 'direct';
    }
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
