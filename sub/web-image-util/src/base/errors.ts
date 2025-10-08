// Import from unified type system
import { ImageErrorCodeConstants, ImageProcessError } from '../types';

/**
 * Image source loading error
 *
 * @description Error that occurs during image source loading process
 * Can be caused by invalid URL, network error, CORS issues, etc.
 */
export class ImageSourceError extends ImageProcessError {
  constructor(
    message: string,
    public source: any,
    originalError?: Error
  ) {
    super(message, ImageErrorCodeConstants.SOURCE_LOAD_FAILED, originalError);
    this.name = 'ImageSourceError';
  }
}

/**
 * Image conversion error
 *
 * @description Error that occurs during image format conversion process
 * Can be caused by unsupported format or conversion failure.
 */
export class ImageConversionError extends ImageProcessError {
  constructor(message: string, fromFormat: string, toFormat: string, originalError?: Error) {
    super(`${message} (${fromFormat} → ${toFormat})`, ImageErrorCodeConstants.CONVERSION_FAILED, originalError);
    this.name = 'ImageConversionError';
  }
}

/**
 * Canvas-related error
 *
 * @description Error that occurs when Canvas creation or 2D context acquisition fails
 * Can be caused by browser support issues or insufficient memory.
 */
export class ImageCanvasError extends ImageProcessError {
  constructor(message: string, originalError?: Error) {
    super(message, ImageErrorCodeConstants.CANVAS_CREATION_FAILED, originalError);
    this.name = 'ImageCanvasError';
  }
}

/**
 * Image resizing error
 *
 * @description Error that occurs during image size adjustment process
 * Can be caused by invalid size values or insufficient memory.
 */
export class ImageResizeError extends ImageProcessError {
  constructor(message: string, originalError?: Error) {
    super(message, ImageErrorCodeConstants.RESIZE_FAILED, originalError);
    this.name = 'ImageResizeError';
  }
}
