/**
 * Performance utilities - user-friendly API
 *
 * @description Provides simple performance control functions
 */

import { BatchResizer } from './batch-resizer';
import { getPerformanceConfig, type ResizeProfile } from './performance-config';
import { SmartProcessor } from './smart-processor.internal';

/**
 * 모듈 스코프에 보관하는 기본 성능 프로파일이다.
 *
 * @description `ResizePerformance.setProfile()`이 쓰고, `getProfile()`과 인자 없는
 * `getConfig()`가 읽는다. 이 세 곳 외에는 라이브러리 어디서도 읽지 않으므로,
 * 프로파일을 바꿔도 `processImage()` 체인·프리셋·출력 파이프라인의 결과는 달라지지 않는다.
 */
let globalPerformanceProfile: ResizeProfile = 'balanced';

/**
 * Performance control utilities
 *
 * @description `setProfile()`로 지정한 프로파일은 `getProfile()`과 인자 없는 `getConfig()`에만
 * 반영된다. `processImage()` 체인, 프리셋 함수, 출력 파이프라인은 이 값을 참조하지 않으므로
 * 프로파일을 바꿔도 이미지 처리 결과는 그대로다. 아래 배치 헬퍼들도 각자 고정 설정을 쓴다.
 *
 * 설정값을 직접 읽어 자체 처리 파이프라인에 반영하려는 호출자를 위한 표면이다.
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
   * 기본 성능 프로파일을 지정한다.
   *
   * @description 이 값을 읽는 곳은 `getProfile()`과 인자 없는 `getConfig()`뿐이다.
   */
  static setProfile(profile: ResizeProfile): void {
    globalPerformanceProfile = profile;
  }

  /**
   * 현재 지정된 기본 성능 프로파일을 반환한다.
   */
  static getProfile(): ResizeProfile {
    return globalPerformanceProfile;
  }

  /**
   * 성능 프로파일에 해당하는 설정값을 반환한다.
   *
   * @param profile 조회할 프로파일. 생략하면 `setProfile()`로 지정한 기본 프로파일을 쓴다.
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
