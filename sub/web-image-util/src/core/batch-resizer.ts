/**
 * Simple batch resizer
 *
 * @description Efficiently processes multiple images without complex monitoring
 */

import { AutoMemoryManager } from './auto-memory-manager';
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
    const { concurrency, timeout } = this.config;
    const results: T[] = [];

    // Process in chunks
    for (let i = 0; i < jobs.length; i += concurrency!) {
      const chunk = jobs.slice(i, i + concurrency!);

      // Memory check
      await this.memoryManager.checkAndOptimize();

      // Concurrent processing (with timeout)
      const chunkResults = await Promise.all(chunk.map((job) => this.runWithTimeout(job.operation, timeout! * 1000)));

      results.push(...chunkResults);
    }

    return results;
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
