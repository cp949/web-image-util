/**
 * Automatic memory manager - Transparent memory optimization
 *
 * @description Automatically checks memory status and optimizes
 * so users don't need to worry about memory management.
 */

import { CanvasPool } from '../base/canvas-pool';
import { debugLog, productionLog } from '../utils/debug';

/**
 * Memory status information
 */
interface MemoryInfo {
  /** Memory pressure level (0-1) */
  pressure: number;
  /** Available memory (MB) */
  availableMB: number;
  /** Used memory (MB) */
  usedMB: number;
  /** Total memory limit (MB) */
  limitMB: number;
}

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
    if (!this.instance) {
      this.instance = new AutoMemoryManager();
    }
    return this.instance;
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
  private async performOptimization(memoryInfo: MemoryInfo): Promise<void> {
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
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
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
   */
  getMemoryInfo(): MemoryInfo {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
      const availableMB = limitMB - usedMB;

      return {
        pressure: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
        availableMB: Math.round(availableMB),
        usedMB: Math.round(usedMB),
        limitMB: Math.round(limitMB),
      };
    }

    // Default values (environment where memory information cannot be obtained)
    return {
      pressure: 0.5,
      availableMB: 256,
      usedMB: 128,
      limitMB: 512,
    };
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
