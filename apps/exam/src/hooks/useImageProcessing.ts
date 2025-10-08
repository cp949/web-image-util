// Enhanced image processing hook - Full utilization of v2.0 API

import { useState, useCallback, useEffect } from 'react';
import { processImage, ImageProcessError } from '@cp949/web-image-util';
import type { ResizeConfig } from '@cp949/web-image-util';
import type {
  ProcessingOptions,
  DemoState,
  ImageInfo,
  ProcessedImageInfo,
  ResultBlob,
} from '../components/demos/types';
import { getErrorMessage, isRecoverableError, logError, formatFileSize } from '../utils/errorHandling';

/**
 * Image information extraction helper
 */
async function extractImageInfo(source: File | string): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      if (typeof source === 'string') {
        resolve({
          src: source,
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: source.split('.').pop()?.toLowerCase(),
        });
      } else {
        const url = URL.createObjectURL(source);
        resolve({
          src: url,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: source.size,
          format: source.type.split('/')[1],
          name: source.name,
        });
      }
    };

    img.onerror = () => {
      reject(new Error('Unable to load image'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const url = URL.createObjectURL(source);
      img.src = url;
    }
  });
}

/**
 * Image processing hook options
 */
export interface UseImageProcessingOptions {
  /** Whether to automatically process with default settings when image is selected (default: false) */
  autoProcess?: boolean;
  /** Default options to use for auto processing */
  defaultOptions?: ProcessingOptions;
}

/**
 * Default processing options
 */
const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  fit: 'cover',
  width: 800,
  height: 600,
  quality: 85,
  format: 'jpeg',
};

/**
 * Type-safe helper to convert ProcessingOptions to ResizeConfig
 * Generate exact ResizeConfig types for each fit mode
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
      // maxFit requires at least one of width or height
      if (options.width && options.height) {
        return { fit: 'maxFit', width: options.width, height: options.height, ...baseConfig };
      } else if (options.width) {
        return { fit: 'maxFit', width: options.width, ...baseConfig };
      } else if (options.height) {
        return { fit: 'maxFit', height: options.height, ...baseConfig };
      }
      // Use default values if both are missing
      return { fit: 'maxFit', width: 800, height: 600, ...baseConfig };

    case 'minFit':
      // minFit also requires at least one of width or height
      if (options.width && options.height) {
        return { fit: 'minFit', width: options.width, height: options.height, ...baseConfig };
      } else if (options.width) {
        return { fit: 'minFit', width: options.width, ...baseConfig };
      } else if (options.height) {
        return { fit: 'minFit', height: options.height, ...baseConfig };
      }
      // Use default values if both are missing
      return { fit: 'minFit', width: 800, height: 600, ...baseConfig };

    default:
      // Default: cover mode
      return {
        fit: 'cover',
        width: options.width ?? 800,
        height: options.height ?? 600,
        ...baseConfig,
      };
  }
}

/**
 * Common image processing logic (deduplication, enhanced type safety)
 */
async function processImageWithOptions(
  imageSource: string,
  processingOptions: ProcessingOptions,
  originalSize?: number
): Promise<ProcessedImageInfo> {
  const startTime = performance.now();

  // Generate type-safe ResizeConfig
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
 * Enhanced image processing hook
 * @param options - Hook configuration options
 * @param options.autoProcess - Whether to automatically process when image is selected (default: false)
 * @param options.defaultOptions - Default options to use for auto processing
 */
export function useImageProcessing(options?: UseImageProcessingOptions) {
  const [state, setState] = useState<DemoState>({
    originalImage: null,
    processedImages: [],
    processing: false,
    error: null,
  });

  // ObjectURL memory cleanup
  useEffect(() => {
    return () => {
      state.processedImages.forEach((img) => {
        if (img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }
      });

      if (state.originalImage?.src.startsWith('blob:')) {
        URL.revokeObjectURL(state.originalImage.src);
      }
    };
  }, [state.originalImage, state.processedImages]);

  /**
   * Image processing handler (utilizing common logic)
   */
  const handleProcess = useCallback(
    async (processingOptions: ProcessingOptions) => {
      if (!state.originalImage) return;

      setState((prev) => ({ ...prev, processing: true, error: null }));

      try {
        const processedInfo = await processImageWithOptions(
          state.originalImage.src,
          processingOptions,
          state.originalImage.size
        );

        setState((prev) => ({
          ...prev,
          processedImages: [...prev.processedImages, processedInfo],
          processing: false,
        }));
      } catch (error) {
        logError(error, 'handleProcess');
        setState((prev) => ({
          ...prev,
          processing: false,
          error: error instanceof ImageProcessError ? error : new Error('Image processing failed'),
        }));
      }
    },
    [state.originalImage]
  );

  /**
   * Image selection handler (🆕 Phase 1: autoProcess support, utilizing common logic)
   */
  const handleImageSelect = useCallback(
    async (source: File | string) => {
      setState((prev) => ({ ...prev, processedImages: [], error: null }));

      try {
        const imageInfo = await extractImageInfo(source);
        setState((prev) => ({ ...prev, originalImage: imageInfo }));

        // 🆕 Phase 1: When auto processing option is enabled
        if (options?.autoProcess) {
          const processingOptions = options.defaultOptions || DEFAULT_PROCESSING_OPTIONS;
          setState((prev) => ({ ...prev, processing: true, error: null }));

          try {
            // Utilize common processing function
            const processedInfo = await processImageWithOptions(
              imageInfo.src,
              processingOptions,
              imageInfo.size
            );

            setState((prev) => ({
              ...prev,
              processedImages: [processedInfo],
              processing: false,
            }));
          } catch (error) {
            logError(error, 'autoProcess');
            setState((prev) => ({
              ...prev,
              processing: false,
              error: error instanceof ImageProcessError ? error : new Error('Auto image processing failed'),
            }));
          }
        }
      } catch (error) {
        logError(error, 'handleImageSelect');
        setState((prev) => ({
          ...prev,
          error: error instanceof ImageProcessError ? error : new Error('Image information extraction failed'),
        }));
      }
    },
    [options?.autoProcess, options?.defaultOptions]
  );


  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Retry (recoverable errors only)
   */
  const retry = useCallback(
    async (options: ProcessingOptions) => {
      if (isRecoverableError(state.error)) {
        clearError();
        await handleProcess(options);
      }
    },
    [state.error, handleProcess, clearError]
  );

  /**
   * Reset processing results
   */
  const reset = useCallback(() => {
    setState({
      originalImage: null,
      processedImages: [],
      processing: false,
      error: null,
    });
  }, []);

  return {
    // State
    originalImage: state.originalImage,
    processedImages: state.processedImages,
    processing: state.processing,
    error: state.error,

    // Actions
    handleImageSelect,
    handleProcess,
    clearError,
    retry,
    reset,

    // Utilities
    getErrorMessage: () => (state.error ? getErrorMessage(state.error) : null),
    canRetry: isRecoverableError(state.error),
  };
}