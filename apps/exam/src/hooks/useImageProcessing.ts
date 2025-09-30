// 강화된 이미지 처리 훅 - v2.0 API 완전 활용

import { useState, useCallback, useEffect } from 'react';
import { processImage, ImageProcessError } from '@cp949/web-image-util';
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
 * 강화된 이미지 처리 훅
 */
export function useImageProcessing() {
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
   * 이미지 선택 핸들러
   */
  const handleImageSelect = useCallback(async (source: File | string) => {
    setState((prev) => ({ ...prev, processedImages: [], error: null }));

    try {
      const imageInfo = await extractImageInfo(source);
      setState((prev) => ({ ...prev, originalImage: imageInfo }));
    } catch (error) {
      logError(error, 'handleImageSelect');
      setState((prev) => ({
        ...prev,
        error: error instanceof ImageProcessError ? error : new Error('이미지 정보 추출 실패'),
      }));
    }
  }, []);

  /**
   * 이미지 처리 핸들러
   */
  const handleProcess = useCallback(
    async (options: ProcessingOptions) => {
      if (!state.originalImage) return;

      setState((prev) => ({ ...prev, processing: true, error: null }));

      try {
        const startTime = performance.now();

        const result: ResultBlob = await processImage(state.originalImage.src)
          .resize(options.width, options.height, {
            fit: options.fit,
            background: options.background,
            withoutEnlargement: options.withoutEnlargement,
            withoutReduction: options.withoutReduction,
          })
          .toBlob({
            format: options.format,
            quality: options.quality / 100,
          });

        const endTime = performance.now();
        const url = URL.createObjectURL(result.blob);

        const processedInfo: ProcessedImageInfo = {
          src: url,
          width: result.width,
          height: result.height,
          size: result.blob.size,
          format: options.format,
          processingTime: endTime - startTime,
          originalSize: result.originalSize || { width: result.width, height: result.height },
          compressionRatio: state.originalImage.size ? result.blob.size / state.originalImage.size : undefined,
        };

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