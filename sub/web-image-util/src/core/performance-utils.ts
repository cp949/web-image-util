/**
 * 성능 유틸리티 - 사용자 친화적 API
 *
 * @description 간단한 성능 제어 함수들 제공
 */

import { BatchResizer } from './batch-resizer';
import { getPerformanceConfig, type ResizeProfile } from './performance-config';
import { SmartProcessor } from './smart-processor';

/**
 * 전역 성능 설정
 */
let globalPerformanceProfile: ResizeProfile = 'balanced';

/**
 * 성능 제어 유틸리티
 *
 * @example
 * ```typescript
 * // 전역 성능 프로파일 설정
 * ResizePerformance.setProfile('fast');
 *
 * // 고속 배치 처리
 * const results = await ResizePerformance.fastBatch(images, 300, 200);
 *
 * // 메모리 사용량 확인
 * const info = ResizePerformance.getMemoryInfo();
 * ```
 */
export class ResizePerformance {
  /**
   * 전역 성능 프로파일 설정
   */
  static setProfile(profile: ResizeProfile): void {
    globalPerformanceProfile = profile;
  }

  /**
   * 현재 성능 프로파일 조회
   */
  static getProfile(): ResizeProfile {
    return globalPerformanceProfile;
  }

  /**
   * 성능 프로파일별 설정 조회
   */
  static getConfig(profile?: ResizeProfile) {
    return getPerformanceConfig(profile || globalPerformanceProfile);
  }

  /**
   * 고속 배치 처리 - fast 프로파일 사용
   */
  static async fastBatch(images: HTMLImageElement[], width: number, height: number): Promise<HTMLCanvasElement[]> {
    return SmartProcessor.resizeBatch(images, width, height, {
      performance: 'fast',
      strategy: 'fast',
    });
  }

  /**
   * 고품질 배치 처리 - quality 프로파일 사용
   */
  static async qualityBatch(images: HTMLImageElement[], width: number, height: number): Promise<HTMLCanvasElement[]> {
    return SmartProcessor.resizeBatch(images, width, height, {
      performance: 'quality',
      strategy: 'quality',
    });
  }

  /**
   * 메모리 효율적 배치 처리
   */
  static async memoryEfficientBatch(
    images: HTMLImageElement[],
    width: number,
    height: number
  ): Promise<HTMLCanvasElement[]> {
    const batcher = new BatchResizer({
      concurrency: 1, // 하나씩 처리
      useCanvasPool: false, // 풀 비활성화
      memoryLimitMB: 64, // 낮은 메모리 제한
      timeout: 120, // 긴 타임아웃
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
   * 간단한 메모리 정보 조회
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
   * 성능 권장사항 제공
   */
  static getRecommendation(
    imageCount: number,
    avgImageSize: number
  ): {
    profile: ResizeProfile;
    reason: string;
  } {
    const memoryInfo = this.getMemoryInfo();

    // 메모리 압박 상황
    if (memoryInfo.pressureLevel === 'high') {
      return {
        profile: 'balanced',
        reason: '높은 메모리 사용량으로 인해 balanced 프로파일 권장',
      };
    }

    // 대량 이미지 + 고해상도
    if (imageCount > 10 && avgImageSize > 2_000_000) {
      return {
        profile: 'fast',
        reason: '대량 고해상도 이미지로 fast 프로파일 권장',
      };
    }

    // 소량 이미지 + 품질 중시
    if (imageCount <= 5) {
      return {
        profile: 'quality',
        reason: '소량 이미지로 quality 프로파일 권장',
      };
    }

    return {
      profile: 'balanced',
      reason: '일반적인 상황으로 balanced 프로파일 권장',
    };
  }
}

/**
 * 간편 함수들
 */

/**
 * 고속 리사이징
 */
export async function fastResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return SmartProcessor.process(img, width, height, {
    performance: 'fast',
    strategy: 'fast',
  });
}

/**
 * 고품질 리사이징
 */
export async function qualityResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return SmartProcessor.process(img, width, height, {
    performance: 'quality',
    strategy: 'quality',
  });
}

/**
 * 자동 최적화 리사이징
 */
export async function autoResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  const recommendation = ResizePerformance.getRecommendation(1, img.width * img.height);

  return SmartProcessor.process(img, width, height, {
    performance: recommendation.profile,
    strategy: 'auto',
  });
}
