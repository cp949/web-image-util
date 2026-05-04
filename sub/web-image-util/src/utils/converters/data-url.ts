/**
 * convertToDataURL 계열 변환 함수.
 *
 * @description 다양한 입력을 Data URL로 변환하는 deprecated 호환 API.
 * 새 코드는 ./ensure 모듈의 ensureDataURL*을 사용한다.
 */

import { convertToImageElement } from '../../core/source-converter';
import type { ImageSource, ResultDataURL } from '../../types';
import { ImageProcessError } from '../../types';
import { DataURLResultImpl } from '../../types/result-implementations';
import { blobToDataURL, isDataURLString } from '../data-url';
import { canvasToDataURL, getBlobDimensions, imageElementToCanvas } from './canvas-bridge';
import type { ConvertToDataURLDetailedOptions, ConvertToDataURLOptions } from './types';

/**
 * Convert various image sources to Data URL
 *
 * @description Convert images to Base64-encoded Data URL
 * Can be used directly in HTML img tag src
 * Use `toDataURLDetailed()` function when metadata is needed.
 *
 * @param source Image source
 * @param options Conversion options
 * @returns Data URL string
 *
 * @deprecated 기존 호환성용 API입니다. 새 코드에서는 `ensureDataURL()`을 사용하세요.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const dataURL = await convertToDataURL(imageElement);
 * imgTag.src = dataURL;
 *
 * // Convert to high-quality JPEG
 * const dataURL = await convertToDataURL(blob, {
 *   format: 'jpeg',
 *   quality: 0.95
 * });
 * ```
 */
export async function convertToDataURL(
  source: ImageSource | HTMLCanvasElement,
  options: ConvertToDataURLOptions = {}
): Promise<string> {
  try {
    // Direct conversion for Canvas
    if (source instanceof HTMLCanvasElement) {
      return canvasToDataURL(source, options);
    }

    // For Blob
    if (source instanceof Blob) {
      return await blobToDataURL(source);
    }

    // For HTMLImageElement, convert through Canvas (apply format/quality options)
    const imageElement = await convertToImageElement(source);

    // Direct conversion if no options (faster)
    if (!options.format && options.quality === undefined) {
      // Return as-is if already Data URL
      if (isDataURLString(source)) {
        return source;
      }
    }

    // Conversion through Canvas
    const canvas = await imageElementToCanvas(imageElement);
    return canvasToDataURL(canvas, options);
  } catch (error) {
    throw new ImageProcessError('Error occurred during Data URL conversion', 'CONVERSION_FAILED', { cause: error });
  }
}

/**
 * Convert various image sources to Data URL (with detailed information)
 *
 * @description Convert images to Base64-encoded Data URL and return them with metadata.
 *
 * @param source Image source
 * @param options Conversion options
 * @returns DataURLResult object (Data URL with metadata)
 *
 * @deprecated 기존 호환성용 API입니다. 새 코드에서는 `ensureDataURLDetailed()`을 사용하세요.
 *
 * @example
 * ```typescript
 * // With detailed information
 * const result = await toDataURLDetailed(imageElement);
 * // Can check Data URL length and size
 * // result.dataURL.length, result.width, result.height
 *
 * // Convert to high-quality JPEG
 * const result = await toDataURLDetailed(blob, {
 *   format: 'jpeg',
 *   quality: 0.95
 * });
 * ```
 */
export async function convertToDataURLDetailed(
  source: ImageSource | HTMLCanvasElement,
  options: ConvertToDataURLDetailedOptions = {}
): Promise<ResultDataURL> {
  const startTime = Date.now();

  try {
    // Direct conversion for Canvas
    if (source instanceof HTMLCanvasElement) {
      const dataURL = canvasToDataURL(source, options);
      return new DataURLResultImpl(dataURL, source.width, source.height, Date.now() - startTime);
    }

    // For Blob
    if (source instanceof Blob) {
      const dataURL = await blobToDataURL(source);
      const { width, height } = await getBlobDimensions(source);
      return new DataURLResultImpl(dataURL, width, height, Date.now() - startTime);
    }

    // For HTMLImageElement, convert through Canvas (apply format/quality options)
    const imageElement = await convertToImageElement(source);

    // Direct conversion if no options (faster)
    if (!options.format && options.quality === undefined) {
      // Return as-is if already Data URL
      if (isDataURLString(source)) {
        return new DataURLResultImpl(source, imageElement.width, imageElement.height, Date.now() - startTime);
      }
    }

    // Conversion through Canvas
    const canvas = await imageElementToCanvas(imageElement);
    const dataURL = canvasToDataURL(canvas, options);

    return new DataURLResultImpl(dataURL, canvas.width, canvas.height, Date.now() - startTime, {
      width: imageElement.width,
      height: imageElement.height,
    });
  } catch (error) {
    throw new ImageProcessError('Error occurred during Data URL conversion', 'CONVERSION_FAILED', { cause: error });
  }
}
