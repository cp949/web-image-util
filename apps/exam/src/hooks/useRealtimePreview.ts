// Real-time preview hook - Phase 4.2
// Simplified version using react-use useDebounce

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from 'react-use';
import { processImage, ImageProcessError } from '@cp949/web-image-util';
import type { ResizeConfig } from '@cp949/web-image-util';
import type { ProcessingOptions, ImageInfo, ProcessedImageInfo, ResultBlob } from '../components/demos/types';
import { logError } from '../utils/errorHandling';

/**
 * Real-time preview hook options
 */
export interface UseRealtimePreviewOptions {
  /** Debounce delay time (milliseconds, default: 500ms) */
  debounceMs?: number;
  /** Auto processing enabled (default: true) */
  enabled?: boolean;
  /** Minimum change detection threshold (reprocess only when option changes exceed this value) */
  changeThreshold?: number;
}

/**
 * Convert ProcessingOptions to ResizeConfig (same as useImageProcessing)
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
 * Generate options hash (for memoization)
 * Compare only important properties to prevent unnecessary reprocessing
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
 * Real-time preview hook (simplified version using react-use useDebounce)
 *
 * Automatically reprocess images through debouncing when options change.
 *
 * @example
 * ```tsx
 * const { preview, processing, updateOptions } = useRealtimePreview(
 *   originalImage,
 *   { debounceMs: 300, enabled: true }
 * );
 *
 * // Automatically update preview when options change
 * updateOptions({ width: 400, height: 300, fit: 'cover' });
 * ```
 */
export function useRealtimePreview(originalImage: ImageInfo | null, hookOptions?: UseRealtimePreviewOptions) {
  const { debounceMs = 500, enabled = true } = hookOptions ?? {};

  const [preview, setPreview] = useState<ProcessedImageInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [options, setOptions] = useState<ProcessingOptions | null>(null);

  // Last processed options hash (prevent duplicate processing)
  const lastProcessedHashRef = useRef<string>('');

  /**
   * Image processing function (simplified version)
   */
  const processImageWithOptions = useCallback(
    async (processingOptions: ProcessingOptions): Promise<ProcessedImageInfo> => {
      if (!originalImage) {
        throw new Error('No original image available');
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

      // Processing completed

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
   * Auto processing with react-use useDebounce
   */
  const [, cancelDebounce] = useDebounce(
    async () => {
      if (!options || !originalImage || !enabled) {
        return;
      }

      const optionsHash = hashOptions(options);

      // Skip if same options (memoization)
      if (optionsHash === lastProcessedHashRef.current) {
        return;
      }

      setProcessing(true);
      setError(null);

      try {
        const result = await processImageWithOptions(options);

        // Clean up previous preview URL
        if (preview?.src.startsWith('blob:')) {
          URL.revokeObjectURL(preview.src);
        }

        setPreview(result);
        lastProcessedHashRef.current = optionsHash;
      } catch (err) {
        logError(err, 'useRealtimePreview.debounced');
        setError(err instanceof ImageProcessError ? err : new Error('Preview generation failed'));
      } finally {
        setProcessing(false);
      }
    },
    debounceMs,
    [options, originalImage, enabled, preview, processImageWithOptions]
  );

  /**
   * Options update function (simplified)
   */
  const updateOptions = useCallback((newOptions: ProcessingOptions) => {
    setOptions(newOptions);
  }, []);

  /**
   * Process immediately (without debounce)
   */
  const processImmediately = useCallback(
    async (processingOptions?: ProcessingOptions) => {
      const optionsToUse = processingOptions ?? options;
      if (!optionsToUse || !originalImage) {
        return;
      }

      // Cancel debounce
      cancelDebounce();

      setProcessing(true);
      setError(null);

      try {
        const result = await processImageWithOptions(optionsToUse);

        // Clean up previous preview URL
        if (preview?.src.startsWith('blob:')) {
          URL.revokeObjectURL(preview.src);
        }

        setPreview(result);
        lastProcessedHashRef.current = hashOptions(optionsToUse);
      } catch (err) {
        logError(err, 'useRealtimePreview.processImmediately');
        setError(err instanceof ImageProcessError ? err : new Error('Preview generation failed'));
      } finally {
        setProcessing(false);
      }
    },
    [options, originalImage, preview, processImageWithOptions, cancelDebounce]
  );

  /**
   * Reset function
   */
  const reset = useCallback(() => {
    // Cancel debounce
    cancelDebounce();

    // Clean up URL
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
   * Reset when original image changes
   */
  useEffect(() => {
    reset();
  }, [originalImage, reset]);

  /**
   * Cleanup on unmount
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
   * Current status summary
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
      // State
      preview,
      processing,
      error,
      options,
      status,

      // Actions
      updateOptions,
      processImmediately,
      reset,
    }),
    [preview, processing, error, options, status, updateOptions, processImmediately, reset]
  );
}
