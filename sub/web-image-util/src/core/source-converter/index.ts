/**
 * source-converter 서브모듈의 진입점이다.
 *
 * 다양한 입력 소스를 단일 HTMLImageElement로 정규화하는 오케스트레이션을 담당하며,
 * 실제 변환 로직은 형태별 로더 모듈에 위임한다.
 */

import type { ImageSource, ProcessorOptions } from '../../types';
import { ImageProcessError } from '../../types';
import { convertBlobToElement, detectMimeTypeFromBuffer } from './loaders/blob';
import { convertCanvasToElement } from './loaders/canvas';
import { convertStringToElement } from './loaders/string';
import type { InternalSourceConverterOptions } from './options';

/**
 * Convert all ImageSource types to HTMLImageElement (main function)
 *
 * @description
 * Converts various types of image sources to unified HTMLImageElement format.
 * This function plays a core role in normalizing all processor inputs.
 *
 * **Supported Types:**
 * - HTMLImageElement: Already loaded images are returned as-is
 * - HTMLCanvasElement: Convert to Data URL then load
 * - Blob/File: ObjectURL or SVG special processing
 * - ArrayBuffer/Uint8Array: Auto-detect MIME type then convert to Blob
 * - String: URL, Data URL, SVG XML, file path, etc.
 *
 * **SVG Special Processing:**
 * - SVG applies normalization, complexity analysis, high-quality rendering
 * - Use optimized conversion path to preserve vector quality
 *
 * @param source Image source to convert
 * @param options Conversion options (CORS settings, etc.)
 * @returns Fully loaded HTMLImageElement
 *
 * @throws {ImageProcessError} When source type is unsupported or conversion fails
 */
export async function convertToImageElement(
  source: ImageSource,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  // 공개 시그니처는 ProcessorOptions를 유지하고, 내부 전달 시 한 번만 좁혀 사용한다.
  const internalOptions = options as InternalSourceConverterOptions | undefined;
  try {
    if (source instanceof HTMLImageElement) {
      // Check if image is already loaded
      if (source.complete && source.naturalWidth > 0) {
        return source;
      }

      // Wait until loading is complete
      return new Promise((resolve, reject) => {
        if (source.complete && source.naturalWidth > 0) {
          resolve(source);
        } else {
          source.onload = () => resolve(source);
          source.onerror = () => reject(new ImageProcessError('Failed to load HTMLImageElement', 'SOURCE_LOAD_FAILED'));
        }
      });
    }

    // HTMLCanvasElement processing
    if (
      source instanceof HTMLCanvasElement ||
      (source && typeof source === 'object' && 'getContext' in source && 'toDataURL' in source)
    ) {
      return convertCanvasToElement(source as HTMLCanvasElement);
    }

    // Blob detection - use both instanceof and duck typing
    if (
      source instanceof Blob ||
      (source &&
        typeof source === 'object' &&
        'type' in source &&
        'size' in source &&
        ('slice' in source || 'arrayBuffer' in source))
    ) {
      return convertBlobToElement(source as Blob, internalOptions);
    }

    if (source instanceof ArrayBuffer) {
      const mimeType = detectMimeTypeFromBuffer(source);
      const blob = new Blob([source], { type: mimeType });
      return convertBlobToElement(blob, internalOptions);
    }

    if (source instanceof Uint8Array) {
      // Safely convert Uint8Array to ArrayBuffer
      const arrayBuffer =
        source.buffer instanceof ArrayBuffer
          ? source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
          : source.slice().buffer;
      const mimeType = detectMimeTypeFromBuffer(arrayBuffer);
      const blob = new Blob([arrayBuffer], { type: mimeType });
      return convertBlobToElement(blob, internalOptions);
    }

    if (typeof source === 'string') {
      return convertStringToElement(source, internalOptions);
    }

    throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError(
      'Unknown error occurred during source conversion',
      'SOURCE_LOAD_FAILED',
      error as Error
    );
  }
}

/**
 * Get size information of image source
 *
 * @description Extract actual size information from various image sources.
 * @param source Image source to get size information from
 * @returns Width and height information of the image
 */
export async function getImageDimensions(source: ImageSource): Promise<{
  width: number;
  height: number;
}> {
  const element = await convertToImageElement(source);
  return {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}
