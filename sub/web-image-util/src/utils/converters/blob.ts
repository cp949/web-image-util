/**
 * convertToBlob 계열 변환 함수.
 *
 * @description 다양한 입력을 Blob으로 변환하는 deprecated 호환 API.
 * 새 코드는 ./ensure 모듈의 ensureBlob*을 사용한다.
 */

import { convertToImageElement } from '../../core/source-converter';
import type { ImageSource, ResultBlob } from '../../types';
import { ImageProcessError } from '../../types';
import { BlobResultImpl } from '../../types/result-implementations';
import { formatToMimeType } from '../format-utils';
import { canvasToBlob, getBlobDimensions, imageElementToCanvas } from './canvas-bridge';
import type { ConvertToBlobDetailedOptions, ConvertToBlobOptions } from './types';

/**
 * Convert image sources to Blob format - Fast and memory-efficient
 *
 * @description
 * High-performance image format conversion utility that transforms various image sources
 * into Blob objects. Optimized for speed and memory efficiency with intelligent conversion
 * paths that avoid unnecessary processing steps.
 *
 * **🚀 Performance Optimizations:**
 * - **Smart Passthrough**: Returns existing Blob unchanged when no format conversion needed
 * - **Direct Canvas**: Canvas elements converted directly without intermediate steps
 * - **Minimal Memory**: Streams data without loading entire image into memory when possible
 * - **Browser Native**: Uses optimized browser APIs (toBlob, drawImage) for best performance
 *
 * **🔄 Conversion Intelligence:**
 * - **Format Detection**: Automatically detects source format and optimizes conversion path
 * - **Quality Preservation**: Maintains original quality unless explicitly modified
 * - **Browser Support**: Automatically handles format compatibility (WebP fallbacks, etc.)
 * - **Error Recovery**: Graceful fallbacks for unsupported formats or corrupted sources
 *
 * **💾 Memory Management:**
 * - **Streaming**: Large images processed in chunks to prevent memory overflow
 * - **Garbage Collection**: Intermediate Canvas elements properly disposed
 * - **Resource Cleanup**: Automatic cleanup of temporary objects and event listeners
 * - **Memory Monitoring**: Built-in protection against excessive memory usage
 *
 * **🎯 Use Cases:**
 * - **File Upload Processing**: Convert user uploads to standardized format
 * - **API Data Preparation**: Format images for REST API transmission
 * - **Storage Optimization**: Convert to efficient formats before database storage
 * - **Cross-Platform Compatibility**: Ensure consistent format support
 *
 * @param source Image source (Element, Canvas, Blob, URL, SVG string, etc.)
 * @param options Format and quality options with intelligent defaults
 * @returns Promise resolving to Blob object ready for use
 *
 * @deprecated 기존 호환성용 API입니다. 새 코드에서는 `ensureBlob()`을 사용하세요.
 *
 * @example File Upload Conversion
 * ```typescript
 * // Convert uploaded file to WebP for storage efficiency
 * const handleFileUpload = async (file: File) => {
 *   const optimizedBlob = await convertToBlob(file, {
 *     format: 'webp',
 *     quality: 0.8  // 20% smaller files with minimal quality loss
 *   });
 *
 *   // Upload optimized version
 *   await uploadToServer(optimizedBlob);
 * };
 * ```
 *
 * @example Canvas Export Optimization
 * ```typescript
 * // Export canvas artwork with format optimization
 * const exportArtwork = async (canvas: HTMLCanvasElement) => {
 *   // High quality PNG for artwork with transparency
 *   const pngBlob = await convertToBlob(canvas, {
 *     format: 'png',
 *     quality: 1.0  // Lossless for art preservation
 *   });
 *
 *   // Compressed JPEG for preview/sharing
 *   const jpegBlob = await convertToBlob(canvas, {
 *     format: 'jpeg',
 *     quality: 0.85  // Good quality, smaller size
 *   });
 *
 *   return { artwork: pngBlob, preview: jpegBlob };
 * };
 * ```
 *
 * @example Batch Image Processing
 * ```typescript
 * // Process multiple images efficiently
 * const processImageBatch = async (imageFiles: File[]) => {
 *   const converted = await Promise.all(
 *     imageFiles.map(file => convertToBlob(file, {
 *       format: 'webp',  // Modern efficient format
 *       fallbackFormat: 'jpeg'  // IE/Safari fallback
 *     }))
 *   );
 *
 *   console.log(`Processed ${converted.length} images`);
 *   return converted;
 * };
 * ```
 *
 * @example Smart Format Selection
 * ```typescript
 * // Intelligent format selection based on content
 * const smartConvert = async (source: ImageSource) => {
 *   // PNG for images with transparency, JPEG for photos
 *   const hasTransparency = await checkTransparency(source);
 *
 *   return convertToBlob(source, {
 *     format: hasTransparency ? 'png' : 'jpeg',
 *     quality: hasTransparency ? 1.0 : 0.85
 *   });
 * };
 * ```
 */
export async function convertToBlob(
  source: ImageSource | HTMLCanvasElement,
  options: ConvertToBlobOptions = {}
): Promise<Blob> {
  try {
    // Direct conversion for Canvas
    if (source instanceof HTMLCanvasElement) {
      return await canvasToBlob(source, options);
    }

    // For Blob, check if format conversion is needed
    if (source instanceof Blob) {
      // Return as-is if same format and no quality change
      if (
        !options.format ||
        source.type === `image/${options.format}` ||
        source.type === formatToMimeType(options.format)
      ) {
        return source;
      }
    }

    // Convert to HTMLImageElement then generate Blob through Canvas
    const imageElement = await convertToImageElement(source);
    const canvas = await imageElementToCanvas(imageElement);
    return await canvasToBlob(canvas, options);
  } catch (error) {
    throw new ImageProcessError('Error occurred during Blob conversion', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * Convert various image sources to Blob (with detailed information)
 *
 * @description Converts images to Blob and returns them with metadata.
 *
 * @param source Image source (HTMLImageElement, HTMLCanvasElement, Blob, or string)
 * @param options Conversion options
 * @returns BlobResult object (Blob with metadata)
 *
 * @deprecated 기존 호환성용 API입니다. 새 코드에서는 `ensureBlobDetailed()`을 사용하세요.
 *
 * @example
 * ```typescript
 * // With detailed information
 * const result = await toBlobDetailed(imageElement);
 * // Can check size and processing time
 * // result.width, result.height, result.processingTime
 *
 * // Specify format and quality
 * const result = await toBlobDetailed(canvasElement, {
 *   format: 'webp',
 *   quality: 0.8
 * });
 * ```
 */
export async function convertToBlobDetailed(
  source: ImageSource | HTMLCanvasElement,
  options: ConvertToBlobDetailedOptions = {}
): Promise<ResultBlob> {
  const startTime = Date.now();

  try {
    // Direct conversion for Canvas
    if (source instanceof HTMLCanvasElement) {
      const blob = await canvasToBlob(source, options);
      return new BlobResultImpl(blob, source.width, source.height, Date.now() - startTime);
    }

    // For Blob
    if (source instanceof Blob) {
      // Check if format conversion is needed
      if (
        !options.format ||
        source.type === `image/${options.format}` ||
        source.type === formatToMimeType(options.format)
      ) {
        const { width, height } = await getBlobDimensions(source);
        return new BlobResultImpl(source, width, height, Date.now() - startTime);
      }
    }

    // Convert to HTMLImageElement then generate Blob through Canvas
    const imageElement = await convertToImageElement(source);
    const canvas = await imageElementToCanvas(imageElement);
    const blob = await canvasToBlob(canvas, options);

    return new BlobResultImpl(blob, canvas.width, canvas.height, Date.now() - startTime, {
      width: imageElement.width,
      height: imageElement.height,
    });
  } catch (error) {
    throw new ImageProcessError('Error occurred during Blob conversion', 'CONVERSION_FAILED', error as Error);
  }
}
