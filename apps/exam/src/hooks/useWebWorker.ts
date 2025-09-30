import { useCallback } from 'react';
import { processImage } from '@cp949/web-image-util';

interface WebWorkerHookOptions {
  maxConcurrency?: number;
  timeout?: number;
}

/**
 * 메인 스레드 기반 이미지 처리 훅
 *
 * @description 현재는 메인 스레드에서 @cp949/web-image-util을 사용하여 이미지 처리를 수행합니다.
 * 간단한 처리는 충분히 빠르며, 복잡한 처리의 경우 적절한 진행률 표시를 통해 UX를 개선할 수 있습니다.
 */
export function useImageWorker(_options: WebWorkerHookOptions = {}) {
  // 실제 이미지 처리 메서드
  const processImageAsync = useCallback(async (source: any, processingOptions: any = {}) => {
    try {
      return await processImage(source)
        .resize(processingOptions.width, processingOptions.height, {
          fit: processingOptions.fit || 'cover',
          background: processingOptions.background || '#ffffff',
        })
        .toBlob({
          format: processingOptions.format || 'jpeg',
          quality: processingOptions.quality || 0.8,
        });
    } catch (error) {
      console.error('이미지 처리 중 오류:', error);
      throw error;
    }
  }, []);

  const analyzeImage = useCallback(async (source: any) => {
    try {
      // 기본적인 이미지 정보 분석
      if (typeof source === 'string') {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = source;
        });

        return {
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight,
          format: source.split('.').pop()?.toLowerCase(),
          hasTransparency: false, // Canvas로 확인 가능하지만 복잡함
        };
      } else if (source instanceof Blob) {
        const img = new Image();
        const url = URL.createObjectURL(source);

        try {
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });

          return {
            width: img.naturalWidth,
            height: img.naturalHeight,
            aspectRatio: img.naturalWidth / img.naturalHeight,
            format: source.type.split('/')[1],
            size: source.size,
            hasTransparency: source.type === 'image/png',
          };
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      return null;
    } catch (error) {
      console.error('이미지 분석 중 오류:', error);
      throw error;
    }
  }, []);

  const optimizeImage = useCallback(async (source: any, targetFormat: string = 'webp') => {
    try {
      // 포맷 최적화: WebP 지원 시 WebP, 아니면 JPEG 사용
      const canvas = document.createElement('canvas');
      const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');

      const format = supportsWebP && targetFormat === 'webp' ? 'webp' : 'jpeg';
      const quality = format === 'webp' ? 0.8 : 0.85;

      return await processImage(source).toBlob({
        format: format as any,
        quality,
      });
    } catch (error) {
      console.error('이미지 최적화 중 오류:', error);
      throw error;
    }
  }, []);

  // 상태 정보 (실제 처리가 완료되면 업데이트)
  const stats = {
    activeWorkers: 0,
    totalRequests: 0,
    completedRequests: 0,
    queueLength: 0,
  };

  return {
    processImage: processImageAsync,
    analyzeImage,
    optimizeImage,
    stats,
  };
}
