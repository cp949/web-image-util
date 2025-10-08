// Batch processing hook - Phase 4.2
// Process images simultaneously with multiple settings and compare results

import { useState, useCallback, useRef } from 'react';
import { processImage, ImageProcessError } from '@cp949/web-image-util';
import type { ResizeConfig } from '@cp949/web-image-util';
import type { ProcessingOptions, ImageInfo, ProcessedImageInfo, ResultBlob } from '../components/demos/types';
import { logError } from '../utils/errorHandling';

/**
 * Batch processing item
 */
export interface BatchItem {
  id: string;
  label: string;
  options: ProcessingOptions;
}

/**
 * Batch processing result
 */
export interface BatchResult extends BatchItem {
  result?: ProcessedImageInfo;
  error?: Error;
  processingTime?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Batch processing hook options
 */
export interface UseBatchProcessingOptions {
  /** Limit for concurrent processing (default: 3) */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Convert ProcessingOptions to ResizeConfig
 */
function toResizeConfig(options: ProcessingOptions): ResizeConfig {
  const baseConfig = {
    background: options.background,
    padding: options.padding,
  };

  switch (options.fit) {
    case 'cover':
      return {
        fit: 'cover',
        width: options.width ?? 800,
        height: options.height ?? 600,
        ...baseConfig,
      };

    case 'contain':
      return {
        fit: 'contain',
        width: options.width ?? 800,
        height: options.height ?? 600,
        withoutEnlargement: options.withoutEnlargement,
        ...baseConfig,
      };

    case 'fill':
      return {
        fit: 'fill',
        width: options.width ?? 800,
        height: options.height ?? 600,
        ...baseConfig,
      };

    case 'maxFit':
      if (options.width && options.height) {
        return { fit: 'maxFit', width: options.width, height: options.height, ...baseConfig };
      } else if (options.width) {
        return { fit: 'maxFit', width: options.width, ...baseConfig };
      } else if (options.height) {
        return { fit: 'maxFit', height: options.height, ...baseConfig };
      }
      return { fit: 'maxFit', width: 800, height: 600, ...baseConfig };

    case 'minFit':
      if (options.width && options.height) {
        return { fit: 'minFit', width: options.width, height: options.height, ...baseConfig };
      } else if (options.width) {
        return { fit: 'minFit', width: options.width, ...baseConfig };
      } else if (options.height) {
        return { fit: 'minFit', height: options.height, ...baseConfig };
      }
      return { fit: 'minFit', width: 800, height: 600, ...baseConfig };

    default:
      return {
        fit: 'cover',
        width: options.width ?? 800,
        height: options.height ?? 600,
        ...baseConfig,
      };
  }
}

/**
 * Single image processing function
 */
async function processSingleImage(
  imageSource: string,
  processingOptions: ProcessingOptions,
  originalSize?: number
): Promise<ProcessedImageInfo> {
  const startTime = performance.now();
  const resizeConfig = toResizeConfig(processingOptions);

  const result: ResultBlob = await processImage(imageSource)
    .resize(resizeConfig)
    .toBlob({
      format: processingOptions.format,
      quality: processingOptions.quality / 100,
    });

  const endTime = performance.now();
  const url = URL.createObjectURL(result.blob);

  return {
    src: url,
    width: result.width,
    height: result.height,
    size: result.blob.size,
    format: processingOptions.format,
    processingTime: endTime - startTime,
    originalSize: result.originalSize || { width: result.width, height: result.height },
    compressionRatio: originalSize ? result.blob.size / originalSize : undefined,
  };
}

/**
 * Parallel processing function (with concurrency limit)
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;
  const total = items.length;

  // Process in chunks
  for (let i = 0; i < total; i += concurrency) {
    const chunk = items.slice(i, Math.min(i + concurrency, total));
    const chunkResults = await Promise.all(chunk.map((item, chunkIndex) => processor(item, i + chunkIndex)));
    results.push(...chunkResults);

    completed += chunk.length;
    onProgress?.(completed, total);
  }

  return results;
}

/**
 * Batch processing hook
 *
 * Process images simultaneously with multiple settings and compare results.
 *
 * @example
 * ```tsx
 * const { results, processing, processBatch } = useBatchProcessing(originalImage, {
 *   concurrency: 3,
 *   onProgress: (completed, total) => console.log(`${completed}/${total}`)
 * });
 *
 * const batchItems: BatchItem[] = [
 *   { id: '1', label: 'Small', options: { width: 200, height: 200, fit: 'cover' } },
 *   { id: '2', label: 'Medium', options: { width: 400, height: 400, fit: 'cover' } },
 *   { id: '3', label: 'Large', options: { width: 800, height: 800, fit: 'cover' } },
 * ];
 *
 * await processBatch(batchItems);
 * ```
 */
export function useBatchProcessing(originalImage: ImageInfo | null, hookOptions?: UseBatchProcessingOptions) {
  const { concurrency = 3 } = hookOptions ?? {};

  const [results, setResults] = useState<BatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<Error | null>(null);

  // Ref for canceling ongoing operations
  const abortControllerRef = useRef<AbortController | null>(null);
  // Manage onProgress callback with ref to stabilize dependencies
  const onProgressRef = useRef(hookOptions?.onProgress);
  onProgressRef.current = hookOptions?.onProgress;

  const onProgress = useCallback((completed: number, total: number) => {
    onProgressRef.current?.(completed, total);
  }, []);

  /**
   * Execute batch processing
   */
  const processBatch = useCallback(
    async (items: BatchItem[]) => {
      if (!originalImage) {
        setError(new Error('No original image available'));
        return;
      }

      // Cancel previous operation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setProcessing(true);
      setError(null);
      setProgress({ completed: 0, total: items.length });

      // Set initial result state
      const initialResults: BatchResult[] = items.map((item) => ({
        ...item,
        status: 'pending' as const,
      }));
      setResults(initialResults);

      try {
        // Parallel processing (with concurrency limit)
        const processedResults = await processWithConcurrency(
          items,
          async (item, index) => {
            // Check if operation was cancelled
            if (abortController.signal.aborted) {
              throw new Error('Operation was cancelled');
            }

            // Update status: processing
            setResults((prev) => prev.map((r, i) => (i === index ? { ...r, status: 'processing' as const } : r)));

            try {
              const startTime = performance.now();
              const result = await processSingleImage(originalImage.src, item.options, originalImage.size);
              const endTime = performance.now();

              const batchResult: BatchResult = {
                ...item,
                result,
                processingTime: endTime - startTime,
                status: 'completed',
              };

              // Update status: completed
              setResults((prev) => prev.map((r, i) => (i === index ? batchResult : r)));

              return batchResult;
            } catch (err) {
              const batchResult: BatchResult = {
                ...item,
                error: err instanceof ImageProcessError ? err : new Error('Processing failed'),
                status: 'failed',
              };

              // Update status: failed
              setResults((prev) => prev.map((r, i) => (i === index ? batchResult : r)));

              logError(err, `useBatchProcessing.processBatch[${item.id}]`);
              return batchResult;
            }
          },
          concurrency,
          (completed, total) => {
            setProgress({ completed, total });
            onProgress?.(completed, total);
          }
        );

        setResults(processedResults);
      } catch (err) {
        // Don't treat cancellation as an error
        if (err instanceof Error && err.message.includes('cancelled')) {
          return;
        }

        logError(err, 'useBatchProcessing.processBatch');
        setError(err instanceof Error ? err : new Error('Batch processing failed'));
      } finally {
        setProcessing(false);
        abortControllerRef.current = null;
      }
    },
    [originalImage, concurrency, onProgress]
  );

  /**
   * Cancel batch processing
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * Reset results
   */
  const reset = useCallback(() => {
    // Clean up previous URLs
    results.forEach((result) => {
      if (result.result?.src.startsWith('blob:')) {
        URL.revokeObjectURL(result.result.src);
      }
    });

    setResults([]);
    setProcessing(false);
    setProgress({ completed: 0, total: 0 });
    setError(null);
  }, [results]);

  /**
   * Filter successful results only
   */
  const successfulResults = results.filter((r) => r.status === 'completed' && r.result);

  /**
   * Filter failed results only
   */
  const failedResults = results.filter((r) => r.status === 'failed');

  return {
    // State
    results,
    processing,
    progress,
    error,
    successfulResults,
    failedResults,

    // Actions
    processBatch,
    cancel,
    reset,

    // Statistics
    stats: {
      total: results.length,
      completed: results.filter((r) => r.status === 'completed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      pending: results.filter((r) => r.status === 'pending').length,
      processing: results.filter((r) => r.status === 'processing').length,
    },
  };
}
