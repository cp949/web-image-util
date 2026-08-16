/**
 * Simple batch resizer
 *
 * @description Efficiently processes multiple images without complex monitoring
 */

import { processInChunks } from '../utils/chunked-batch-runner.internal';
import { AutoMemoryManager } from './auto-memory-manager.internal';
import type { ResizePerformanceOptions } from './performance-config';
import { getPerformanceConfig, type ResizeProfile } from './performance-config';

/**
 * Simple job definition for batch processing
 */
export interface BatchResizeJob<T = any> {
  /** Function to process */
  operation: () => Promise<T>;
  /** Job ID (optional) */
  id?: string;
}

/**
 * Simplified batch resizer
 *
 * `/advanced` 서브엔트리의 `AdvancedImageProcessor.batchProcess()`도 청크 실행에 같은
 * seam(`processInChunks()`, `utils/chunked-batch-runner.internal.ts`)을 쓴다 — 다만 실행기
 * 자체를 합치지는 않았다(docs/maintenance-risks.md Low 항목, 별도 카드로 보류). 이쪽은
 * timeout과 `AutoMemoryManager.checkAndOptimize()` 메모리 점검을 갖고 progress 콜백은 없다;
 * `batchProcess()`는 반대로 `onProgress`/`onImageComplete` 콜백을 갖고 timeout·메모리
 * 점검은 없다. 필요에 따라 골라 쓰되, 기능 추가 시 다른 쪽도 같이 볼 것.
 *
 * @example
 * ```typescript
 * const batcher = new BatchResizer('fast');
 * const jobs = images.map(img => ({
 *   operation: () => processImage(img).resize({ fit: 'cover', width: 300, height: 200 }).toBlob()
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
   * Process all jobs in batches
   */
  async processAll<T>(jobs: BatchResizeJob<T>[]): Promise<T[]> {
    const concurrency = this.config.concurrency ?? 2;
    const timeout = this.config.timeout ?? 30;

    return processInChunks(jobs, concurrency, (job) => this.runWithTimeout(job.operation, timeout * 1000), {
      beforeChunk: () => this.memoryManager.checkAndOptimize(),
    });
  }

  /**
   * Execute operation with timeout
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
   * Get current configuration
   */
  getConfig(): ResizePerformanceOptions {
    return { ...this.config };
  }
}
