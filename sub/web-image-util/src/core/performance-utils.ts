/**
 * Performance utilities - user-friendly API
 *
 * @description Provides simple performance control functions
 */

import { BatchResizer } from './batch-resizer';
import { getPerformanceConfig, type ResizeProfile } from './performance-config';
import { SmartProcessor } from './smart-processor';

/**
 * Global performance configuration
 */
let globalPerformanceProfile: ResizeProfile = 'balanced';

/**
 * Performance control utilities
 *
 * @example
 * ```typescript
 * // Set global performance profile
 * ResizePerformance.setProfile('fast');
 *
 * // Fast batch processing
 * const results = await ResizePerformance.fastBatch(images, 300, 200);
 *
 * // Check memory usage
 * const info = ResizePerformance.getMemoryInfo();
 * ```
 */
export class ResizePerformance {
  /**
   * Set global performance profile
   */
  static setProfile(profile: ResizeProfile): void {
    globalPerformanceProfile = profile;
  }

  /**
   * Get current performance profile
   */
  static getProfile(): ResizeProfile {
    return globalPerformanceProfile;
  }

  /**
   * Get configuration by performance profile
   */
  static getConfig(profile?: ResizeProfile) {
    return getPerformanceConfig(profile || globalPerformanceProfile);
  }

  /**
   * Fast batch processing - uses fast profile
   */
  static async fastBatch(images: HTMLImageElement[], width: number, height: number): Promise<HTMLCanvasElement[]> {
    return SmartProcessor.resizeBatch(images, width, height, {
      performance: 'fast',
      strategy: 'fast',
    });
  }

  /**
   * High-quality batch processing - uses quality profile
   */
  static async qualityBatch(images: HTMLImageElement[], width: number, height: number): Promise<HTMLCanvasElement[]> {
    return SmartProcessor.resizeBatch(images, width, height, {
      performance: 'quality',
      strategy: 'quality',
    });
  }

  /**
   * Memory-efficient batch processing
   */
  static async memoryEfficientBatch(
    images: HTMLImageElement[],
    width: number,
    height: number
  ): Promise<HTMLCanvasElement[]> {
    const batcher = new BatchResizer({
      concurrency: 1, // Process one at a time
      useCanvasPool: false, // Disable pooling
      memoryLimitMB: 64, // Low memory limit
      timeout: 120, // Long timeout
    });

    const jobs = images.map((img, index) => ({
      id: `memory-resize-${index}`,
      operation: () =>
        SmartProcessor.process(img, width, height, {
          strategy: 'memory-efficient',
        }),
    }));

    return batcher.processAll(jobs);
  }

  /**
   * Get simple memory information
   */
  static getMemoryInfo(): {
    usedMB: number;
    limitMB: number;
    pressureLevel: 'low' | 'medium' | 'high';
  } {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
      const limitMB = Math.round(memory.jsHeapSizeLimit / (1024 * 1024));
      const pressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      let pressureLevel: 'low' | 'medium' | 'high';
      if (pressure < 0.5) pressureLevel = 'low';
      else if (pressure < 0.8) pressureLevel = 'medium';
      else pressureLevel = 'high';

      return { usedMB, limitMB, pressureLevel };
    }

    return { usedMB: 0, limitMB: 0, pressureLevel: 'low' };
  }

  /**
   * Provide performance recommendations
   */
  static getRecommendation(
    imageCount: number,
    avgImageSize: number
  ): {
    profile: ResizeProfile;
    reason: string;
  } {
    const memoryInfo = this.getMemoryInfo();

    // High memory pressure situation
    if (memoryInfo.pressureLevel === 'high') {
      return {
        profile: 'balanced',
        reason: 'Balanced profile recommended due to high memory usage',
      };
    }

    // Large volume of high-resolution images
    if (imageCount > 10 && avgImageSize > 2_000_000) {
      return {
        profile: 'fast',
        reason: 'Fast profile recommended for large volume of high-resolution images',
      };
    }

    // Small volume of images + quality focus
    if (imageCount <= 5) {
      return {
        profile: 'quality',
        reason: 'Quality profile recommended for small volume of images',
      };
    }

    return {
      profile: 'balanced',
      reason: 'Balanced profile recommended for general situations',
    };
  }
}

/**
 * Convenience functions
 */

/**
 * Fast resizing
 */
export async function fastResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return SmartProcessor.process(img, width, height, {
    performance: 'fast',
    strategy: 'fast',
  });
}

/**
 * High-quality resizing
 */
export async function qualityResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return SmartProcessor.process(img, width, height, {
    performance: 'quality',
    strategy: 'quality',
  });
}

/**
 * Auto-optimized resizing
 */
export async function autoResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  const recommendation = ResizePerformance.getRecommendation(1, img.width * img.height);

  return SmartProcessor.process(img, width, height, {
    performance: recommendation.profile,
    strategy: 'auto',
  });
}
