/**
 * Type guard functions
 *
 * @description Functions for safely verifying types at runtime
 * Support TypeScript type narrowing to improve compile-time safety
 */

import type { ImageSource, ImageFormat, ResizeFit, ResizePosition, ResizeBackground } from './base';

// Define constants directly to prevent circular imports
const VALID_RESIZE_FITS = ['cover', 'contain', 'fill', 'maxFit', 'minFit'] as const;
const VALID_IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'svg'] as const;

const VALID_POSITION_STRINGS = new Set([
  'center',
  'centre',
  'top',
  'right',
  'bottom',
  'left',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
  'left top',
  'right top',
  'left bottom',
  'right bottom',
]);

// CSS color regex - simple and practical version
const CSS_COLOR_REGEX = /^(#[0-9a-f]{3,8}|rgb|rgba|hsl|hsla|[a-z])/i;

// Type guard helper functions
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

function isValidRGBValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

// DOM type guards
/**
 * HTMLImageElement type guard
 *
 * @param value Value to check
 * @returns Whether it's an HTMLImageElement
 */
export function isImageElement(value: unknown): value is HTMLImageElement {
  return value instanceof HTMLImageElement;
}

/**
 * HTMLCanvasElement type guard
 *
 * @param value Value to check
 * @returns Whether it's an HTMLCanvasElement
 */
export function isCanvasElement(value: unknown): value is HTMLCanvasElement {
  return value instanceof HTMLCanvasElement;
}

/**
 * Blob type guard
 *
 * @param value Value to check
 * @returns Whether it's a Blob
 */
export function isBlob(value: unknown): value is Blob {
  return value instanceof Blob;
}

/**
 * File type guard
 *
 * @param value Value to check
 * @returns Whether it's a File
 */
export function isFile(value: unknown): value is File {
  return value instanceof File;
}

/**
 * Uint8Array type guard
 *
 * @param value Value to check
 * @returns Whether it's a Uint8Array
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

/**
 * ArrayBuffer type guard
 *
 * @param value Value to check
 * @returns Whether it's an ArrayBuffer
 */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

// String type guards
/**
 * Data URL string type guard
 *
 * @param value Value to check
 * @returns Whether it's a Data URL string
 * @example
 * ```typescript
 * isDataURL('data:image/png;base64,iVBOR...') // true
 * isDataURL('http://example.com/image.jpg') // false
 * ```
 */
export function isDataURL(value: unknown): value is string {
  return isNonEmptyString(value) && value.startsWith('data:image/');
}

/**
 * HTTP/HTTPS URL string type guard
 *
 * @param value Value to check
 * @returns Whether it's an HTTP/HTTPS URL string
 * @example
 * ```typescript
 * isHttpURL('https://example.com/image.jpg') // true
 * isHttpURL('ftp://example.com/file.txt') // false
 * ```
 */
export function isHttpURL(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * SVG string type guard
 *
 * @param value Value to check
 * @returns Whether it's an SVG string
 * @description Supports both SVGs with XML declarations and those starting directly with <svg tag
 * @example
 * ```typescript
 * isSVGString('<svg><circle r="40"/></svg>') // true
 * isSVGString('<?xml version="1.0"?><svg>...</svg>') // true
 * isSVGString('<?xml version="1.0"?><div>...</div>') // false
 * ```
 */
export function isSVGString(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;

  const trimmed = value.trim();

  // Must have both opening <svg and closing </svg> tags
  if (!trimmed.includes('<svg') || !trimmed.includes('</svg>')) {
    return false;
  }

  // 1. Case starting directly with <svg
  if (trimmed.startsWith('<svg')) {
    return true;
  }

  // 2. Case starting with XML declaration - first tag after declaration must be <svg
  if (trimmed.startsWith('<?xml')) {
    const afterXmlDeclaration = trimmed.replace(/^<\?xml[^>]*\?>\s*/, '');
    return afterXmlDeclaration.startsWith('<svg');
  }

  return false;
}

// Composite type guards
/**
 * Valid image source type guard
 *
 * @param value Value to check
 * @returns Whether it's a valid ImageSource
 * @description Supports HTMLImageElement, Blob, Data URL, HTTP URL, SVG string, file path, etc.
 * @example
 * ```typescript
 * if (isValidImageSource(userInput)) {
 *   // userInput is narrowed to ImageSource type
 *   const result = await processImage(userInput);
 * }
 * ```
 */
export function isValidImageSource(value: unknown): value is ImageSource {
  return (
    isImageElement(value) ||
    isBlob(value) ||
    isDataURL(value) ||
    isHttpURL(value) ||
    isSVGString(value) ||
    isNonEmptyString(value) // File paths, etc.
  );
}

/**
 * Valid resize fit value type guard
 *
 * @param value Value to check
 * @returns Whether it's a valid ResizeFit
 * @description Supports cover, contain, fill values
 */
export function isValidResizeFit(value: unknown): value is ResizeFit {
  return isNonEmptyString(value) && VALID_RESIZE_FITS.includes(value as ResizeFit);
}

/**
 * Valid resize position value type guard
 *
 * @param value Value to check
 * @returns Whether it's a valid ResizePosition
 * @description Supports string ('center', 'top', etc.), number (0-100), and object ({x, y}) formats
 * @example
 * ```typescript
 * isValidResizePosition('center') // true
 * isValidResizePosition(50) // true
 * isValidResizePosition({x: 25, y: 75}) // true
 * ```
 */
export function isValidResizePosition(value: unknown): value is ResizePosition {
  // Number (0-100 range)
  if (isNumberInRange(value, 0, 100)) {
    return true;
  }

  // String position
  if (isNonEmptyString(value) && VALID_POSITION_STRINGS.has(value)) {
    return true;
  }

  // Object {x, y} format
  if (typeof value === 'object' && value !== null) {
    const pos = value as Record<string, unknown>;
    return isNumberInRange(pos.x, 0, 100) && isNumberInRange(pos.y, 0, 100) && Object.keys(pos).length === 2;
  }

  return false;
}

/**
 * Valid background color value type guard
 *
 * @param value Value to check
 * @returns Whether it's a valid ResizeBackground
 * @description Supports CSS color strings (hex, rgb, hsl, etc.) or RGB object format
 * @example
 * ```typescript
 * isValidBackgroundColor('#ffffff') // true
 * isValidBackgroundColor('red') // true
 * isValidBackgroundColor({r: 255, g: 0, b: 0}) // true
 * ```
 */
export function isValidBackgroundColor(value: unknown): value is ResizeBackground {
  // CSS color string
  if (isNonEmptyString(value)) {
    return value === 'transparent' || CSS_COLOR_REGEX.test(value);
  }

  // RGB object
  if (typeof value === 'object' && value !== null) {
    const color = value as Record<string, unknown>;
    const hasValidRGB = isValidRGBValue(color.r) && isValidRGBValue(color.g) && isValidRGBValue(color.b);

    if (!hasValidRGB) return false;

    // alpha is optional, but if present, must be in 0-1 range
    if (color.alpha !== undefined) {
      return isNumberInRange(color.alpha, 0, 1);
    }

    return true;
  }

  return false;
}

/**
 * Valid image format type guard
 *
 * @param value Value to check
 * @returns Whether it's a valid ImageFormat
 * @description Supports jpeg, jpg, png, webp, avif, gif, svg formats
 */
export function isValidImageFormat(value: unknown): value is ImageFormat {
  return isNonEmptyString(value) && VALID_IMAGE_FORMATS.includes(value.toLowerCase() as ImageFormat);
}

/**
 * Valid output format type guard
 *
 * @param value Value to check
 * @returns Whether it's a valid output format
 * @description Supports browser-compatible output formats like jpeg, png, webp
 */
export function isOutputFormat(value: unknown): value is 'jpeg' | 'png' | 'webp' {
  const outputFormats = ['jpeg', 'png', 'webp'] as const;
  return isNonEmptyString(value) && outputFormats.includes(value.toLowerCase() as any);
}

/**
 * ImageSource type guard
 */
export function isImageSource(value: unknown): value is ImageSource {
  return (
    isImageElement(value) ||
    isCanvasElement(value) ||
    isBlob(value) ||
    isArrayBuffer(value) ||
    isUint8Array(value) ||
    isNonEmptyString(value)
  );
}

// Alias functions (for test compatibility)
export const isHTMLImageElement = isImageElement;
export const isHTMLCanvasElement = isCanvasElement;

/**
 * Valid quality value type guard
 *
 * @param value Value to check
 * @returns Whether it's a valid quality value (0.0-1.0)
 * @description Number in 0.0~1.0 range representing image compression quality
 */
export function isValidQuality(value: unknown): value is number {
  return isNumberInRange(value, 0, 1);
}

/**
 * Valid dimension (size) value type guard
 *
 * @param value Value to check
 * @returns Whether it's a valid dimension value (positive number)
 * @description Positive integer used for image width, height, etc.
 */
export function isValidDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// Validation result interface
/**
 * Option validation result interface
 *
 * @interface ValidationResult
 * @property isValid Overall validation result (true if no errors)
 * @property errors Array of error messages
 * @property warnings Array of warning messages
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// ValidationResult factory function
function createValidationResult(): {
  errors: string[];
  warnings: string[];
  build(): ValidationResult;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  return {
    errors,
    warnings,
    build(): ValidationResult {
      return {
        isValid: errors.length === 0,
        errors: Object.freeze([...errors]),
        warnings: Object.freeze([...warnings]),
      };
    },
  };
}

// Option validation functions

/**
 * Output option validation
 *
 * @param options Option object to validate
 * @returns Validation result
 * @description Validates format, quality, fallbackFormat options and returns error and warning messages
 */
export function validateOutputOptions(options: any): ValidationResult {
  const result = createValidationResult();

  // Required validations
  if (options.format !== undefined && !isValidImageFormat(options.format)) {
    result.errors.push(`format must be one of: ${VALID_IMAGE_FORMATS.join(', ')}`);
  }

  if (options.quality !== undefined && !isValidQuality(options.quality)) {
    result.errors.push('quality must be a number between 0.0 and 1.0');
  }

  if (options.fallbackFormat !== undefined && !isValidImageFormat(options.fallbackFormat)) {
    result.errors.push(`fallbackFormat must be one of: ${VALID_IMAGE_FORMATS.join(', ')}`);
  }

  // Warnings
  if (options.quality !== undefined && options.quality < 0.1) {
    result.warnings.push('Quality is very low. Image quality may be significantly degraded');
  }

  if (options.format === 'png' && options.quality !== undefined && options.quality < 1.0) {
    result.warnings.push('PNG is a lossless format, so quality setting will be ignored');
  }

  return result.build();
}

// Type assertion functions
/**
 * Image source assertion
 *
 * @param value Value to check
 * @param paramName Parameter name (used in error message)
 * @throws {TypeError} When not a valid image source
 * @description Validates image source type at runtime and throws error if invalid
 */
export function assertImageSource(value: unknown, paramName = 'source'): asserts value is ImageSource {
  if (!isValidImageSource(value)) {
    throw new TypeError(
      `${paramName} must be a valid image source (HTMLImageElement, Blob, Data URL, HTTP URL, SVG string, or file path)`
    );
  }
}

/**
 * Positive integer assertion
 *
 * @param value Value to check
 * @param paramName Parameter name (used in error message)
 * @throws {TypeError} When not a positive integer
 * @description Validates that dimension values like width, height are positive integers
 */
export function assertPositiveInteger(value: unknown, paramName = 'value'): asserts value is number {
  if (!isValidDimension(value)) {
    throw new TypeError(`${paramName} must be a positive integer`);
  }
}

/**
 * Quality value assertion
 *
 * @param value Value to check
 * @param paramName Parameter name (used in error message)
 * @throws {TypeError} When not a number in 0.0~1.0 range
 * @description Validates that image compression quality is in valid range
 */
export function assertQuality(value: unknown, paramName = 'quality'): asserts value is number {
  if (!isValidQuality(value)) {
    throw new TypeError(`${paramName} must be a number between 0.0 and 1.0`);
  }
}
