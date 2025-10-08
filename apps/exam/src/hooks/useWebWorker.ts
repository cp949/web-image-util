import { useCallback } from 'react';
import { processImage } from '@cp949/web-image-util';

interface WebWorkerHookOptions {
  maxConcurrency?: number;
  timeout?: number;
}

/**
 * Main thread based image processing hook
 *
 * @description Currently performs image processing using @cp949/web-image-util on the main thread.
 * Simple processing is fast enough, and for complex processing, UX can be improved with appropriate progress indicators.
 */
export function useImageWorker(_options: WebWorkerHookOptions = {}) {
  // Actual image processing method
  const processImageAsync = useCallback(async (source: any, processingOptions: any = {}) => {
    try {
      return await processImage(source)
        .resize({
          fit: processingOptions.fit || 'cover',
          width: processingOptions.width,
          height: processingOptions.height,
          background: processingOptions.background || '#ffffff',
        } as any)
        .toBlob({
          format: processingOptions.format || 'jpeg',
          quality: processingOptions.quality || 0.8,
        });
    } catch (error) {
      console.error('Error during image processing:', error);
      throw error;
    }
  }, []);

  const analyzeImage = useCallback(async (source: any) => {
    try {
      // Basic image information analysis
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
          hasTransparency: false, // Can be checked with Canvas but complex
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
      console.error('Error during image analysis:', error);
      throw error;
    }
  }, []);

  const optimizeImage = useCallback(async (source: any, targetFormat: string = 'webp') => {
    try {
      // Format optimization: Use WebP if supported, otherwise JPEG
      const canvas = document.createElement('canvas');
      const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');

      const format = supportsWebP && targetFormat === 'webp' ? 'webp' : 'jpeg';
      const quality = format === 'webp' ? 0.8 : 0.85;

      return await processImage(source).toBlob({
        format: format as any,
        quality,
      });
    } catch (error) {
      console.error('Error during image optimization:', error);
      throw error;
    }
  }, []);

  // Status information (updated when actual processing is completed)
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
