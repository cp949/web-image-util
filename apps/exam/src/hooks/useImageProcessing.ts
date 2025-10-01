// 강화된 이미지 처리 훅 - v2.0 API 완전 활용

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
 * 이미지 정보 추출 헬퍼
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
      reject(new Error('이미지를 불러올 수 없습니다'));
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
 * 이미지 처리 훅 옵션
 */
export interface UseImageProcessingOptions {
  /** 이미지 선택 시 자동으로 기본 설정으로 처리할지 여부 (기본: false) */
  autoProcess?: boolean;
  /** 자동 처리 시 사용할 기본 옵션 */
  defaultOptions?: ProcessingOptions;
}

/**
 * 기본 처리 옵션
 */
const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  fit: 'cover',
  width: 800,
  height: 600,
  quality: 85,
  format: 'jpeg',
};

/**
 * ProcessingOptions를 ResizeConfig로 변환하는 타입 안전한 헬퍼
 * 각 fit 모드에 맞는 정확한 ResizeConfig 타입을 생성
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
      // maxFit은 width나 height 중 최소 하나는 필요
      if (options.width && options.height) {
        return { fit: 'maxFit', width: options.width, height: options.height, ...baseConfig };
      } else if (options.width) {
        return { fit: 'maxFit', width: options.width, ...baseConfig };
      } else if (options.height) {
        return { fit: 'maxFit', height: options.height, ...baseConfig };
      }
      // 둘 다 없으면 기본값 사용
      return { fit: 'maxFit', width: 800, height: 600, ...baseConfig };

    case 'minFit':
      // minFit도 width나 height 중 최소 하나는 필요
      if (options.width && options.height) {
        return { fit: 'minFit', width: options.width, height: options.height, ...baseConfig };
      } else if (options.width) {
        return { fit: 'minFit', width: options.width, ...baseConfig };
      } else if (options.height) {
        return { fit: 'minFit', height: options.height, ...baseConfig };
      }
      // 둘 다 없으면 기본값 사용
      return { fit: 'minFit', width: 800, height: 600, ...baseConfig };

    default:
      // 기본값: cover 모드
      return {
        fit: 'cover',
        width: options.width ?? 800,
        height: options.height ?? 600,
        ...baseConfig,
      };
  }
}

/**
 * 공통 이미지 처리 로직 (중복 제거, 타입 안전성 강화)
 */
async function processImageWithOptions(
  imageSource: string,
  processingOptions: ProcessingOptions,
  originalSize?: number
): Promise<ProcessedImageInfo> {
  const startTime = performance.now();

  // 타입 안전한 ResizeConfig 생성
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
 * 강화된 이미지 처리 훅
 * @param options - 훅 설정 옵션
 * @param options.autoProcess - 이미지 선택 시 자동 처리 여부 (기본: false)
 * @param options.defaultOptions - 자동 처리 시 사용할 기본 옵션
 */
export function useImageProcessing(options?: UseImageProcessingOptions) {
  const [state, setState] = useState<DemoState>({
    originalImage: null,
    processedImages: [],
    processing: false,
    error: null,
  });

  // ObjectURL 메모리 정리
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
   * 이미지 처리 핸들러 (공통 로직 활용)
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
          error: error instanceof ImageProcessError ? error : new Error('이미지 처리 실패'),
        }));
      }
    },
    [state.originalImage]
  );

  /**
   * 이미지 선택 핸들러 (🆕 Phase 1: autoProcess 지원, 공통 로직 활용)
   */
  const handleImageSelect = useCallback(
    async (source: File | string) => {
      setState((prev) => ({ ...prev, processedImages: [], error: null }));

      try {
        const imageInfo = await extractImageInfo(source);
        setState((prev) => ({ ...prev, originalImage: imageInfo }));

        // 🆕 Phase 1: 자동 처리 옵션이 활성화된 경우
        if (options?.autoProcess) {
          const processingOptions = options.defaultOptions || DEFAULT_PROCESSING_OPTIONS;
          setState((prev) => ({ ...prev, processing: true, error: null }));

          try {
            // 공통 처리 함수 활용
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
              error: error instanceof ImageProcessError ? error : new Error('자동 이미지 처리 실패'),
            }));
          }
        }
      } catch (error) {
        logError(error, 'handleImageSelect');
        setState((prev) => ({
          ...prev,
          error: error instanceof ImageProcessError ? error : new Error('이미지 정보 추출 실패'),
        }));
      }
    },
    [options?.autoProcess, options?.defaultOptions]
  );


  /**
   * 에러 클리어
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * 재시도 (복구 가능한 에러만)
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
   * 처리 결과 초기화
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
    // 상태
    originalImage: state.originalImage,
    processedImages: state.processedImages,
    processing: state.processing,
    error: state.error,

    // 액션
    handleImageSelect,
    handleProcess,
    clearError,
    retry,
    reset,

    // 유틸리티
    getErrorMessage: () => (state.error ? getErrorMessage(state.error) : null),
    canRetry: isRecoverableError(state.error),
  };
}