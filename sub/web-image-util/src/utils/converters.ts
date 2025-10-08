/**
 * Image conversion utility functions
 *
 * @description Provides simple and intuitive image conversion functions
 */

import { convertToImageElement } from '../core/source-converter';
import type { ResultBlob, ResultDataURL, ResultFile, ImageSource, OutputOptions } from '../types';
import { ImageProcessError } from '../types';
import { DataURLResultImpl, BlobResultImpl, FileResultImpl } from '../types/result-implementations';

/**
 * Basic Blob conversion options
 */
export interface ConvertToBlobOptions extends OutputOptions {
  // includeMetadata option removed - separated into dedicated function
}

/**
 * Detailed Blob conversion options with metadata
 */
export interface ConvertToBlobDetailedOptions extends OutputOptions {
  // Detailed information is always included
}

/**
 * Basic DataURL conversion options
 */
export interface ConvertToDataURLOptions extends OutputOptions {
  // includeMetadata option removed - separated into dedicated function
}

/**
 * Detailed DataURL conversion options with metadata
 */
export interface ConvertToDataURLDetailedOptions extends OutputOptions {
  // Detailed information is always included
}

/**
 * Basic File conversion options
 */
export interface ConvertToFileOptions extends OutputOptions {
  /** Whether to automatically adjust file extension (default: true) */
  autoExtension?: boolean;
}

/**
 * Detailed File conversion options with metadata
 */
export interface ConvertToFileDetailedOptions extends OutputOptions {
  /** Whether to automatically adjust file extension (default: true) */
  autoExtension?: boolean;
}

/**
 * Convert various image sources to Blob (simple result)
 *
 * @description Converts images to Blob and returns them.
 * Use `toBlobDetailed()` function when metadata is needed.
 *
 * @param source Image source (HTMLImageElement, HTMLCanvasElement, Blob, or string)
 * @param options Conversion options
 * @returns Blob object
 *
 * @example
 * ```typescript
 * // Basic usage
 * const blob = await convertToBlob(imageElement);
 *
 * // Specify format and quality
 * const blob = await convertToBlob(canvasElement, {
 *   format: 'webp',
 *   quality: 0.8
 * });
 *
 * // Blob to Blob (format conversion)
 * const webpBlob = await convertToBlob(jpegBlob, { format: 'webp' });
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
    if (!options.format && !options.quality) {
      // Return as-is if already Data URL
      if (typeof source === 'string' && source.startsWith('data:')) {
        return source;
      }
    }

    // Conversion through Canvas
    const canvas = await imageElementToCanvas(imageElement);
    return canvasToDataURL(canvas, options);
  } catch (error) {
    throw new ImageProcessError('Error occurred during Data URL conversion', 'CONVERSION_FAILED', error as Error);
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
    if (!options.format && !options.quality) {
      // Return as-is if already Data URL
      if (typeof source === 'string' && source.startsWith('data:')) {
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
    throw new ImageProcessError('Error occurred during Data URL conversion', 'CONVERSION_FAILED', error as Error);
  }
}

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
    let finalFilename = filename;
    if (options.autoExtension !== false && options.format) {
      finalFilename = adjustFileExtension(filename, options.format);
    }

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
    let finalFilename = filename;
    if (options.autoExtension !== false && options.format) {
      finalFilename = adjustFileExtension(filename, options.format);
    }

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

// === Internal utility functions ===

/**
 * Convert Canvas to Blob
 */
async function canvasToBlob(canvas: HTMLCanvasElement, options: OutputOptions): Promise<Blob> {
  const mimeType = formatToMimeType(options.format || 'png');
  const quality = options.quality || 0.8;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Retry with fallback format
          const fallbackMimeType = formatToMimeType(options.fallbackFormat || 'png');
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) {
                resolve(fallbackBlob);
              } else {
                reject(new Error('Canvas to Blob conversion failed'));
              }
            },
            fallbackMimeType,
            quality
          );
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Convert Canvas to Data URL
 */
function canvasToDataURL(canvas: HTMLCanvasElement, options: OutputOptions): string {
  const mimeType = formatToMimeType(options.format || 'png');
  const quality = options.quality || 0.8;

  return canvas.toDataURL(mimeType, quality);
}

/**
 * Convert Blob to Data URL
 */
async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Blob to Data URL conversion failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert image source to HTMLImageElement
 *
 * @param source Image source (HTMLImageElement, Blob, URL, Data URL, SVG XML, ArrayBuffer, etc.)
 * @returns HTMLImageElement Promise
 *
 * @example
 * ```typescript
 * import { convertToElement } from '@cp949/web-image-util/utils';
 *
 * const element = await convertToElement(blob);
 * const element2 = await convertToElement('https://example.com/image.jpg');
 * const element3 = await convertToElement('<svg>...</svg>');
 * ```
 */
export async function convertToElement(source: ImageSource): Promise<HTMLImageElement> {
  return convertToImageElement(source);
}

/**
 * Convert HTMLImageElement to Canvas
 */
async function imageElementToCanvas(imageElement: HTMLImageElement): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new ImageProcessError('Unable to create Canvas 2D context', 'CANVAS_CREATION_FAILED');
  }

  canvas.width = imageElement.width;
  canvas.height = imageElement.height;

  ctx.drawImage(imageElement, 0, 0);

  return canvas;
}

/**
 * Get Blob dimension information
 */
async function getBlobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read Blob size information'));
    };

    img.src = url;
  });
}

/**
 * Convert format to MIME type
 */
function formatToMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
  };

  return mimeTypes[format.toLowerCase()] || 'image/png';
}

/**
 * Adjust filename extension
 */
function adjustFileExtension(filename: string, format: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;

  // Unify JPEG to jpg
  const extension = format === 'jpeg' ? 'jpg' : format;

  return `${nameWithoutExt}.${extension}`;
}
