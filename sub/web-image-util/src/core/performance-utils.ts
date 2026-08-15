/**
 * Performance utilities - user-friendly API
 *
 * @description Provides simple performance control functions
 */

import type { ProcessingStrategy } from '../base/high-res-detector.internal';
import { readMemoryBudget } from '../utils/browser-capabilities/index';
import { AutoHighResProcessor } from './auto-high-res';
import { type BatchResizeJob, BatchResizer } from './batch-resizer';
import { getPerformanceConfig, type ResizeProfile } from './performance-config';

/**
 * 이미지마다 AutoHighResProcessor.smartResize()를 호출해 배치 처리한다.
 * ResizePerformance.fastBatch/qualityBatch가 쓰는 얇은 편의 계층이다.
 */
async function resizeBatch(
  images: HTMLImageElement[],
  width: number,
  height: number,
  options: {
    priority?: 'speed' | 'balanced' | 'quality';
    forceStrategy?: ProcessingStrategy;
    performance?: ResizeProfile;
  } = {}
): Promise<HTMLCanvasElement[]> {
  const { priority, forceStrategy, performance = 'balanced' } = options;

  const jobs: BatchResizeJob<HTMLCanvasElement>[] = images.map((img, index) => ({
    id: `resize-${index}`,
    operation: async () =>
      (await AutoHighResProcessor.smartResize(img, width, height, { priority, forceStrategy })).canvas,
  }));

  return processBatch(jobs, performance);
}

/**
 * ResizeProfile 기준으로 구성한 BatchResizer에 작업을 흘려보낸다.
 */
async function processBatch<T>(jobs: BatchResizeJob<T>[], performance: ResizeProfile = 'balanced'): Promise<T[]> {
  return new BatchResizer(performance).processAll(jobs);
}

/**
 * Performance control utilities
 *
 * @description `processImage()` 체인, 프리셋 함수, 출력 파이프라인은 여기 있는 어떤 값도
 * 참조하지 않는다 — 아래 일괄 처리 헬퍼들은 각자 고정 설정을 쓰고, `getConfig()`는 순수 조회다.
 *
 * 설정값을 직접 읽어 자체 처리 파이프라인에 반영하려는 호출자를 위한 표면이다.
 *
 * @example
 * ```typescript
 * // Look up a profile's config
 * const config = ResizePerformance.getConfig('fast');
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
   * 성능 프로파일에 해당하는 설정값을 반환한다. 전역 상태 없는 순수 조회다.
   *
   * @param profile 조회할 프로파일
   */
  static getConfig(profile: ResizeProfile) {
    return getPerformanceConfig(profile);
  }

  /**
   * Fast batch processing - uses fast profile
   */
  static async fastBatch(images: HTMLImageElement[], width: number, height: number): Promise<HTMLCanvasElement[]> {
    return resizeBatch(images, width, height, { performance: 'fast', priority: 'speed' });
  }

  /**
   * High-quality batch processing - uses quality profile
   */
  static async qualityBatch(images: HTMLImageElement[], width: number, height: number): Promise<HTMLCanvasElement[]> {
    return resizeBatch(images, width, height, { performance: 'quality', priority: 'quality' });
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
      timeout: 120, // Long timeout
    });

    const jobs = images.map((img, index) => ({
      id: `memory-resize-${index}`,
      operation: async () =>
        (await AutoHighResProcessor.smartResize(img, width, height, { priority: 'speed', forceStrategy: 'tiled' }))
          .canvas,
    }));

    return batcher.processAll(jobs);
  }

  /**
   * Get simple memory information
   *
   * 메모리 예산은 browser-capabilities/memory.internal.ts가 단일 소유한다. 이 메서드는
   * pressureLevel 버킷(0.5/0.8 임계값)만 로컬 정책으로 남긴다.
   */
  static getMemoryInfo(): {
    usedMB: number;
    limitMB: number;
    pressureLevel: 'low' | 'medium' | 'high';
  } {
    const { usedMB, limitMB, pressure } = readMemoryBudget();

    let pressureLevel: 'low' | 'medium' | 'high';
    if (pressure < 0.5) pressureLevel = 'low';
    else if (pressure < 0.8) pressureLevel = 'medium';
    else pressureLevel = 'high';

    return { usedMB, limitMB, pressureLevel };
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
    const memoryInfo = ResizePerformance.getMemoryInfo();

    // 메모리 압박이 심한 경우 가장 가벼운 프로파일 추천
    if (memoryInfo.pressureLevel === 'high') {
      return {
        profile: 'fast',
        reason: 'Fast profile recommended due to high memory pressure',
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
  return (await AutoHighResProcessor.smartResize(img, width, height, { priority: 'speed' })).canvas;
}

/**
 * High-quality resizing
 */
export async function qualityResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return (await AutoHighResProcessor.smartResize(img, width, height, { priority: 'quality' })).canvas;
}

/**
 * Auto-optimized resizing
 */
export async function autoResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return (await AutoHighResProcessor.smartResize(img, width, height, { priority: 'balanced' })).canvas;
}
