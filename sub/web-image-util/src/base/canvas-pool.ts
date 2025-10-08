/**
 * Canvas pooling management class
 * Optimizes performance by reusing Canvas objects.
 * Dynamic memory management system based on Fabric.js patterns
 */

import { debugLog } from '../utils/debug';
export class CanvasPool {
  private static instance: CanvasPool;
  private pool: HTMLCanvasElement[] = [];
  private maxPoolSize: number;
  private memoryThreshold = 256 * 1024 * 1024; // 256MB

  // Performance statistics
  private stats = {
    totalCreated: 0,
    totalAcquired: 0,
    totalReleased: 0,
    poolHits: 0,
    memoryOptimizations: 0,
  };

  private constructor() {
    this.maxPoolSize = this.getOptimalPoolSize();
  }

  /**
   * Returns singleton instance
   */
  static getInstance(): CanvasPool {
    if (!CanvasPool.instance) {
      CanvasPool.instance = new CanvasPool();
    }
    return CanvasPool.instance;
  }

  /**
   * Calculates optimal pool size based on system memory
   */
  private getOptimalPoolSize(): number {
    const memory = this.getAvailableMemory();
    if (memory > 1024) return 15; // 1GB or more
    if (memory > 512) return 12; // 512MB or more
    if (memory > 256) return 10; // 256MB or more
    return 8; // Default value
  }

  /**
   * Estimates available memory (MB)
   */
  private getAvailableMemory(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return (memory.jsHeapSizeLimit - memory.usedJSHeapSize) / (1024 * 1024);
    }
    return 512; // Default value (512MB)
  }

  /**
   * Acquires Canvas from pool or creates new one
   * @param width - Canvas width (optional)
   * @param height - Canvas height (optional)
   * @returns Reusable Canvas element
   */
  acquire(width?: number, height?: number): HTMLCanvasElement {
    this.stats.totalAcquired++;

    // Check and handle memory pressure
    this.checkMemoryPressure();

    let canvas: HTMLCanvasElement;

    if (this.pool.length > 0) {
      canvas = this.pool.pop()!;
      this.stats.poolHits++;
    } else {
      canvas = document.createElement('canvas');
      this.stats.totalCreated++;
    }

    // Set dimensions
    if (width && height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Initialize Canvas (based on Fabric.js patterns)
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Initialize default settings - only essential settings for performance
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.filter = 'none'; // Added filter initialization
    }

    return canvas;
  }

  /**
   * Detects and handles memory pressure (applying Fabric.js optimization patterns)
   */
  private checkMemoryPressure(): void {
    const currentUsage = this.getEstimatedMemoryUsage();

    if (currentUsage > this.memoryThreshold) {
      // Reduce pool size during memory pressure
      const targetReduction = Math.ceil(this.pool.length * 0.3); // 30% reduction
      this.reducePoolSize(targetReduction);
      this.stats.memoryOptimizations++;
    }
  }

  /**
   * Reduces pool size
   */
  private reducePoolSize(count: number = 1): void {
    for (let i = 0; i < count && this.pool.length > 0; i++) {
      const canvas = this.pool.pop();
      if (canvas) {
        this.disposeCanvas(canvas);
      }
    }
  }

  /**
   * Returns Canvas to pool (applying Fabric.js dispose pattern)
   * @param canvas - Canvas element to return
   */
  release(canvas: HTMLCanvasElement): void {
    this.stats.totalReleased++;

    if (this.pool.length < this.maxPoolSize) {
      // Don't return large Canvas to pool (memory saving)
      const maxSize = 2048 * 2048;
      if (canvas.width * canvas.height <= maxSize) {
        // Clean Canvas state and return to pool
        this.cleanCanvas(canvas);
        this.pool.push(canvas);
        return;
      }
    }

    // Completely dispose if pool is full or Canvas is too large
    this.disposeCanvas(canvas);
  }

  /**
   * Cleans Canvas state (initialization for reuse)
   */
  private cleanCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Initialize context state only (maintain dimensions)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation matrix
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
    }
  }

  /**
   * Complete Canvas disposal (Fabric.js dispose pattern)
   */
  private disposeCanvas(canvas: HTMLCanvasElement): void {
    // Reset dimensions for memory release
    canvas.width = 0;
    canvas.height = 0;
  }

  /**
   * Adjusts pool size
   * @param size - Maximum pool size
   */
  setMaxPoolSize(size: number): void {
    this.maxPoolSize = size;

    // Remove excess Canvas objects
    while (this.pool.length > this.maxPoolSize) {
      const canvas = this.pool.pop();
      if (canvas) {
        this.disposeCanvas(canvas);
      }
    }
  }

  /**
   * Complete pool cleanup (Fabric.js dispose pattern)
   * Called when memory cleanup is needed
   */
  clear(): void {
    // Clean up all Canvas memory
    this.pool.forEach((canvas) => {
      this.disposeCanvas(canvas);
    });

    this.pool = [];
    this.resetStats();
  }

  /**
   * Resets statistics
   */
  private resetStats(): void {
    this.stats = {
      totalCreated: 0,
      totalAcquired: 0,
      totalReleased: 0,
      poolHits: 0,
      memoryOptimizations: 0,
    };
  }

  /**
   * Measures Canvas Pool complexity (Fabric.js complexity pattern)
   * @returns Pool complexity index (0-1)
   */
  complexity(): number {
    const memoryUsage = this.getEstimatedMemoryUsage() / this.memoryThreshold;
    const poolUtilization = this.pool.length / this.maxPoolSize;
    const hitRatio = this.stats.totalAcquired > 0 ? this.stats.poolHits / this.stats.totalAcquired : 0;

    // Complexity = memory usage ratio * 0.5 + pool utilization * 0.3 + (1 - hit ratio) * 0.2
    return Math.min(1, memoryUsage * 0.5 + poolUtilization * 0.3 + (1 - hitRatio) * 0.2);
  }

  /**
   * Current pool status information (extended statistics)
   */
  getStats(): {
    poolSize: number;
    maxPoolSize: number;
    totalCreated: number;
    totalAcquired: number;
    totalReleased: number;
    poolHits: number;
    hitRatio: number;
    memoryUsageMB: number;
    memoryOptimizations: number;
    complexity: number;
  } {
    const hitRatio = this.stats.totalAcquired > 0 ? this.stats.poolHits / this.stats.totalAcquired : 0;

    return {
      poolSize: this.pool.length,
      maxPoolSize: this.maxPoolSize,
      totalCreated: this.stats.totalCreated,
      totalAcquired: this.stats.totalAcquired,
      totalReleased: this.stats.totalReleased,
      poolHits: this.stats.poolHits,
      hitRatio: Math.round(hitRatio * 100) / 100, // 2 decimal places
      memoryUsageMB: Math.round((this.getEstimatedMemoryUsage() / (1024 * 1024)) * 100) / 100,
      memoryOptimizations: this.stats.memoryOptimizations,
      complexity: Math.round(this.complexity() * 100) / 100,
    };
  }

  /**
   * Estimates memory usage (bytes)
   */
  getEstimatedMemoryUsage(): number {
    return this.pool.reduce((total, canvas) => {
      // RGBA 4 bytes * pixel count
      return total + canvas.width * canvas.height * 4;
    }, 0);
  }

  /**
   * Outputs Canvas Pool status information (for debugging)
   */
  logStats(): void {
    const stats = this.getStats();
    debugLog.log('Canvas Pool Stats:', {
      'Pool Size': `${stats.poolSize}/${stats.maxPoolSize}`,
      'Hit Ratio': `${(stats.hitRatio * 100).toFixed(1)}%`,
      'Memory Usage': `${stats.memoryUsageMB}MB`,
      'Total Created': stats.totalCreated,
      Complexity: stats.complexity,
    });
  }
}
