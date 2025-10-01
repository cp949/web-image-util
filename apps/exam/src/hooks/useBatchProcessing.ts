// 배치 처리 훅 - Phase 4.2
// 여러 설정으로 동시에 이미지 처리 및 결과 비교

import { useState, useCallback, useRef } from 'react';
import { processImage, ImageProcessError } from '@cp949/web-image-util';
import type { ResizeConfig } from '@cp949/web-image-util';
import type { ProcessingOptions, ImageInfo, ProcessedImageInfo, ResultBlob } from '../components/demos/types';
import { logError } from '../utils/errorHandling';

/**
 * 배치 처리 아이템
 */
export interface BatchItem {
  id: string;
  label: string;
  options: ProcessingOptions;
}

/**
 * 배치 처리 결과
 */
export interface BatchResult extends BatchItem {
  result?: ProcessedImageInfo;
  error?: Error;
  processingTime?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * 배치 처리 훅 옵션
 */
export interface UseBatchProcessingOptions {
  /** 동시 처리 개수 제한 (기본: 3) */
  concurrency?: number;
  /** 진행 상황 콜백 */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * ProcessingOptions를 ResizeConfig로 변환
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
 * 단일 이미지 처리 함수
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
 * 병렬 처리 함수 (동시성 제한 포함)
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

  // 청크로 나누어 처리
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
 * 배치 처리 훅
 *
 * 여러 설정으로 동시에 이미지를 처리하고 결과를 비교합니다.
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

  // 진행 중인 작업 취소를 위한 ref
  const abortControllerRef = useRef<AbortController | null>(null);
  // onProgress 콜백을 ref로 관리하여 deps 안정화
  const onProgressRef = useRef(hookOptions?.onProgress);
  onProgressRef.current = hookOptions?.onProgress;

  const onProgress = useCallback((completed: number, total: number) => {
    onProgressRef.current?.(completed, total);
  }, []);

  /**
   * 배치 처리 실행
   */
  const processBatch = useCallback(
    async (items: BatchItem[]) => {
      if (!originalImage) {
        setError(new Error('원본 이미지가 없습니다'));
        return;
      }

      // 이전 작업 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setProcessing(true);
      setError(null);
      setProgress({ completed: 0, total: items.length });

      // 초기 결과 상태 설정
      const initialResults: BatchResult[] = items.map((item) => ({
        ...item,
        status: 'pending' as const,
      }));
      setResults(initialResults);

      try {
        // 병렬 처리 (동시성 제한 포함)
        const processedResults = await processWithConcurrency(
          items,
          async (item, index) => {
            // 작업이 취소되었는지 확인
            if (abortController.signal.aborted) {
              throw new Error('작업이 취소되었습니다');
            }

            // 상태 업데이트: processing
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

              // 상태 업데이트: completed
              setResults((prev) => prev.map((r, i) => (i === index ? batchResult : r)));

              return batchResult;
            } catch (err) {
              const batchResult: BatchResult = {
                ...item,
                error: err instanceof ImageProcessError ? err : new Error('처리 실패'),
                status: 'failed',
              };

              // 상태 업데이트: failed
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
        // 취소된 경우는 에러로 처리하지 않음
        if (err instanceof Error && err.message.includes('취소')) {
          return;
        }

        logError(err, 'useBatchProcessing.processBatch');
        setError(err instanceof Error ? err : new Error('배치 처리 실패'));
      } finally {
        setProcessing(false);
        abortControllerRef.current = null;
      }
    },
    [originalImage, concurrency, onProgress]
  );

  /**
   * 배치 처리 취소
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * 결과 초기화
   */
  const reset = useCallback(() => {
    // 이전 URL 정리
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
   * 성공한 결과만 필터링
   */
  const successfulResults = results.filter((r) => r.status === 'completed' && r.result);

  /**
   * 실패한 결과만 필터링
   */
  const failedResults = results.filter((r) => r.status === 'failed');

  return {
    // 상태
    results,
    processing,
    progress,
    error,
    successfulResults,
    failedResults,

    // 액션
    processBatch,
    cancel,
    reset,

    // 통계
    stats: {
      total: results.length,
      completed: results.filter((r) => r.status === 'completed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      pending: results.filter((r) => r.status === 'pending').length,
      processing: results.filter((r) => r.status === 'processing').length,
    },
  };
}
