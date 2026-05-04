/**
 * convertToFile 계열 변환 함수.
 *
 * @description 다양한 입력을 File로 변환하는 deprecated 호환 API.
 * 새 코드는 ./ensure 모듈의 ensureFile*을 사용한다.
 */

import type { ImageSource, ResultFile } from '../../types';
import { ImageProcessError } from '../../types';
import { FileResultImpl } from '../../types/result-implementations';
import { convertToBlob, convertToBlobDetailed } from './blob';
import { getFinalFilename } from './policy';
import type { ConvertToFileDetailedOptions, ConvertToFileOptions } from './types';

/**
 * Convert various image sources to File object
 *
 * @description Create File object that can be added to FormData and uploaded to server
 * File extension is automatically adjusted to match the specified format
 * Use `toFileDetailed()` function when metadata is needed.
 *
 * @param source Image source
 * @param filename Filename
 * @param options Conversion options
 * @returns File object
 *
 * @deprecated 기존 호환성용 API입니다. 새 코드에서는 `ensureFile()`을 사용하세요.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const file = await convertToFile(imageElement, 'photo.jpg');
 *
 * // Convert to WebP and create file
 * const file = await convertToFile(blob, 'image.webp', {
 *   format: 'webp',
 *   quality: 0.8
 * });
 *
 * // Automatic extension correction
 * const file = await convertToFile(source, 'image.png', {
 *   format: 'jpeg', // Filename automatically changed to 'image.jpeg'
 *   autoExtension: true
 * });
 *
 * // Add to FormData and upload
 * const formData = new FormData();
 * formData.append('image', file);
 * await fetch('/upload', { method: 'POST', body: formData });
 * ```
 */
export async function convertToFile(
  source: ImageSource | HTMLCanvasElement,
  filename: string,
  options: ConvertToFileOptions = {}
): Promise<File> {
  try {
    // Generate Blob
    const blob = await convertToBlob(source, options);

    // Automatic filename extension correction
    const finalFilename = getFinalFilename(filename, options);

    // Create File object
    return new File([blob], finalFilename, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    throw new ImageProcessError('Error occurred during File object creation', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * Convert various image sources to File object (with detailed information)
 *
 * @description Create File object that can be added to FormData and uploaded to server, and return with metadata.
 * File extension is automatically adjusted to match the specified format.
 *
 * @param source Image source
 * @param filename Filename
 * @param options Conversion options
 * @returns FileResult object (File with metadata)
 *
 * @deprecated 기존 호환성용 API입니다. 새 코드에서는 `ensureFileDetailed()`을 사용하세요.
 *
 * @example
 * ```typescript
 * // With detailed information
 * const result = await toFileDetailed(imageElement, 'photo.jpg');
 * // Can check file size and image size
 * // result.file.size, result.width, result.height
 *
 * // Convert to WebP and create file
 * const result = await toFileDetailed(blob, 'image.webp', {
 *   format: 'webp',
 *   quality: 0.8
 * });
 * ```
 */
export async function convertToFileDetailed(
  source: ImageSource | HTMLCanvasElement,
  filename: string,
  options: ConvertToFileDetailedOptions = {}
): Promise<ResultFile> {
  const startTime = Date.now();

  try {
    // Generate Blob (with detailed information)
    const blobResult = await convertToBlobDetailed(source, options);

    // Automatic filename extension correction
    const finalFilename = getFinalFilename(filename, options);

    // Create File object
    const file = new File([blobResult.blob], finalFilename, {
      type: blobResult.blob.type,
      lastModified: Date.now(),
    });

    return new FileResultImpl(
      file,
      blobResult.width,
      blobResult.height,
      Date.now() - startTime,
      blobResult.originalSize
    );
  } catch (error) {
    throw new ImageProcessError('Error occurred during File object creation', 'CONVERSION_FAILED', error as Error);
  }
}
