// 실시간 미리보기 훅 - Phase 4.2
// react-use useDebounce로 간소화된 버전

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from 'react-use';
import { processImage, ImageProcessError } from '@cp949/web-image-util';
import type { ResizeConfig } from '@cp949/web-image-util';
import type { ProcessingOptions, ImageInfo, ProcessedImageInfo, ResultBlob } from '../components/demos/types';
import { logError } from '../utils/errorHandling';

/**
 * 실시간 미리보기 훅 옵션
 */
export interface UseRealtimePreviewOptions {
  /** 디바운스 지연 시간 (밀리초, 기본: 500ms) */
  debounceMs?: number;
  /** 자동 처리 활성화 여부 (기본: true) */
  enabled?: boolean;
  /** 최소 변경 감지 임계값 (옵션 변경이 이 값보다 클 때만 재처리) */
  changeThreshold?: number;
}

/**
 * ProcessingOptions를 ResizeConfig로 변환 (useImageProcessing과 동일)
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
 * 옵션 해시 생성 (메모이제이션용)
 * 중요한 속성만 비교하여 불필요한 재처리 방지
 */
function hashOptions(options: ProcessingOptions): string {
  return JSON.stringify({
    fit: options.fit,
    width: options.width,
    height: options.height,
    quality: options.quality,
    format: options.format,
    background: options.background,
    padding: options.padding,
    withoutEnlargement: options.withoutEnlargement,
  });
}

/**
 * 실시간 미리보기 훅 (react-use useDebounce 간소화 버전)
 *
 * 옵션 변경 시 디바운싱을 통해 자동으로 이미지를 재처리합니다.
 *
 * @example
 * ```tsx
 * const { preview, processing, updateOptions } = useRealtimePreview(
 *   originalImage,
 *   { debounceMs: 300, enabled: true }
 * );
 *
 * // 옵션 변경 시 자동으로 미리보기 업데이트
 * updateOptions({ width: 400, height: 300, fit: 'cover' });
 * ```
 */
export function useRealtimePreview(originalImage: ImageInfo | null, hookOptions?: UseRealtimePreviewOptions) {
  const { debounceMs = 500, enabled = true } = hookOptions ?? {};

  const [preview, setPreview] = useState<ProcessedImageInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [options, setOptions] = useState<ProcessingOptions | null>(null);

  // 마지막 처리된 옵션 해시 (중복 처리 방지)
  const lastProcessedHashRef = useRef<string>('');

  /**
   * 이미지 처리 함수 (간소화된 버전)
   */
  const processImageWithOptions = useCallback(
    async (processingOptions: ProcessingOptions): Promise<ProcessedImageInfo> => {
      if (!originalImage) {
        throw new Error('원본 이미지가 없습니다');
      }

      const startTime = performance.now();
      const resizeConfig = toResizeConfig(processingOptions);

      const result: ResultBlob = await processImage(originalImage.src)
        .resize(resizeConfig)
        .toBlob({
          format: processingOptions.format,
          quality: processingOptions.quality / 100,
        });

      const endTime = performance.now();
      const url = URL.createObjectURL(result.blob);

      // 처리 완료

      return {
        src: url,
        width: result.width,
        height: result.height,
        size: result.blob.size,
        format: processingOptions.format,
        processingTime: endTime - startTime,
        originalSize: result.originalSize || { width: result.width, height: result.height },
        compressionRatio: originalImage.size ? result.blob.size / originalImage.size : undefined,
      };
    },
    [originalImage]
  );

  /**
   * react-use useDebounce로 자동 처리
   */
  const [, cancelDebounce] = useDebounce(
    async () => {
      if (!options || !originalImage || !enabled) {
        return;
      }

      const optionsHash = hashOptions(options);

      // 동일한 옵션이면 스킵 (메모이제이션)
      if (optionsHash === lastProcessedHashRef.current) {
        return;
      }

      setProcessing(true);
      setError(null);

      try {
        const result = await processImageWithOptions(options);

        // 이전 미리보기 URL 정리
        if (preview?.src.startsWith('blob:')) {
          URL.revokeObjectURL(preview.src);
        }

        setPreview(result);
        lastProcessedHashRef.current = optionsHash;
      } catch (err) {
        logError(err, 'useRealtimePreview.debounced');
        setError(err instanceof ImageProcessError ? err : new Error('미리보기 생성 실패'));
      } finally {
        setProcessing(false);
      }
    },
    debounceMs,
    [options, originalImage, enabled, preview, processImageWithOptions]
  );

  /**
   * 옵션 업데이트 함수 (간소화됨)
   */
  const updateOptions = useCallback((newOptions: ProcessingOptions) => {
    setOptions(newOptions);
  }, []);

  /**
   * 즉시 처리 (디바운스 없이)
   */
  const processImmediately = useCallback(
    async (processingOptions?: ProcessingOptions) => {
      const optionsToUse = processingOptions ?? options;
      if (!optionsToUse || !originalImage) {
        return;
      }

      // 디바운스 취소
      cancelDebounce();

      setProcessing(true);
      setError(null);

      try {
        const result = await processImageWithOptions(optionsToUse);

        // 이전 미리보기 URL 정리
        if (preview?.src.startsWith('blob:')) {
          URL.revokeObjectURL(preview.src);
        }

        setPreview(result);
        lastProcessedHashRef.current = hashOptions(optionsToUse);
      } catch (err) {
        logError(err, 'useRealtimePreview.processImmediately');
        setError(err instanceof ImageProcessError ? err : new Error('미리보기 생성 실패'));
      } finally {
        setProcessing(false);
      }
    },
    [options, originalImage, preview, processImageWithOptions, cancelDebounce]
  );

  /**
   * 리셋 함수
   */
  const reset = useCallback(() => {
    // 디바운스 취소
    cancelDebounce();

    // URL 정리
    if (preview?.src.startsWith('blob:')) {
      URL.revokeObjectURL(preview.src);
    }

    setPreview(null);
    setProcessing(false);
    setError(null);
    setOptions(null);
    lastProcessedHashRef.current = '';
  }, [preview, cancelDebounce]);

  /**
   * 원본 이미지 변경 시 리셋
   */
  useEffect(() => {
    reset();
  }, [originalImage, reset]);

  /**
   * 언마운트 시 정리
   */
  useEffect(() => {
    return () => {
      cancelDebounce();
      if (preview?.src.startsWith('blob:')) {
        URL.revokeObjectURL(preview.src);
      }
    };
  }, [preview, cancelDebounce]);

  /**
   * 현재 상태 요약
   */
  const status = useMemo(
    () => ({
      hasPreview: !!preview,
      isProcessing: processing,
      hasError: !!error,
      hasOptions: !!options,
      hasOriginalImage: !!originalImage,
    }),
    [preview, processing, error, options, originalImage]
  );

  return useMemo(
    () => ({
      // 상태
      preview,
      processing,
      error,
      options,
      status,

      // 액션
      updateOptions,
      processImmediately,
      reset,
    }),
    [preview, processing, error, options, status, updateOptions, processImmediately, reset]
  );
}
