/**
 * 간단한 배치 리사이저 - 
 *
 * @description 복잡한 모니터링 없이 여러 이미지를 효율적으로 처리
 */

import type { ResizePerformanceOptions } from './performance-config';
import { getPerformanceConfig, type ResizeProfile } from './performance-config';
import { AutoMemoryManager } from './auto-memory-manager';

/**
 * 배치 처리용 간단한 작업 정의
 */
export interface BatchResizeJob<T = any> {
  /** 처리할 함수 */
  operation: () => Promise<T>;
  /** 작업 ID (선택사항) */
  id?: string;
}

/**
 * 간소화된 배치 리사이저
 *
 * @example
 * ```typescript
 * const batcher = new BatchResizer('fast');
 * const jobs = images.map(img => ({
 *   operation: () => processImage(img).resize(300, 200).toBlob()
 * }));
 * const results = await batcher.processAll(jobs);
 * ```
 */
export class BatchResizer {
  private config: ResizePerformanceOptions;
  private memoryManager = AutoMemoryManager.getInstance();

  constructor(profile: ResizeProfile | ResizePerformanceOptions = 'balanced') {
    this.config = typeof profile === 'string' ? getPerformanceConfig(profile) : profile;
  }

  /**
   * 모든 작업을 배치로 처리
   */
  async processAll<T>(jobs: BatchResizeJob<T>[]): Promise<T[]> {
    const { concurrency, timeout } = this.config;
    const results: T[] = [];

    // 청크 단위로 나누어 처리
    for (let i = 0; i < jobs.length; i += concurrency!) {
      const chunk = jobs.slice(i, i + concurrency!);

      // 메모리 체크
      await this.memoryManager.checkAndOptimize();

      // 동시 처리 (타임아웃 적용)
      const chunkResults = await Promise.all(chunk.map((job) => this.runWithTimeout(job.operation, timeout! * 1000)));

      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * 타임아웃이 있는 작업 실행
   */
  private async runWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): ResizePerformanceOptions {
    return { ...this.config };
  }
}
