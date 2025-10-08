/**
 * Error handling helper functions
 *
 * @description Provides user-friendly error messages and solutions
 */

import { globalErrorHandler } from '../core/error-handler';
import { ImageProcessError, type ImageErrorCodeType } from '../types';

/**
 * Error context information
 */
export interface ErrorContext {
  /** Source type being processed */
  sourceType?: string;
  /** Format attempted */
  format?: string;
  /** Image size information */
  dimensions?: { width: number; height: number };
  /** Browser information */
  userAgent?: string;
  /** Timestamp */
  timestamp?: number;
  /** Additional debug information */
  debug?: Record<string, any>;
}

/**
 * User-friendly error message mapping
 */
const USER_FRIENDLY_MESSAGES: Record<ImageErrorCodeType, string> = {
  // Source-related errors
  INVALID_SOURCE: 'Invalid image source. Please use a valid image file or URL.',
  UNSUPPORTED_FORMAT: 'Unsupported image format. Please use standard formats like JPEG, PNG, WebP.',
  SOURCE_LOAD_FAILED: 'Failed to load image. Please check your network connection or file path.',

  // Processing-related errors
  CANVAS_CREATION_FAILED:
    'Cannot create Canvas for image processing. Please verify that your browser supports Canvas.',
  CANVAS_CONTEXT_FAILED: 'Cannot get Canvas 2D context. Please verify that your browser supports Canvas API.',
  RESIZE_FAILED: 'Image resizing failed. There may be an issue with the image size or format.',
  CONVERSION_FAILED: 'Image format conversion failed. Please try a different format.',
  BLUR_FAILED: 'Failed to apply blur effect to image.',
  PROCESSING_FAILED: 'An error occurred during image processing. Please check your image file or options.',
  SMART_RESIZE_FAILED: 'An error occurred during smart resizing. For large images, try with a smaller size.',

  // SVG-related errors
  SVG_LOAD_FAILED: 'Failed to load SVG image. Please check if the SVG syntax is correct.',
  SVG_PROCESSING_FAILED: 'An error occurred during SVG image processing. The SVG file may be corrupted.',

  // Output-related errors
  OUTPUT_FAILED: 'Image output failed. Please check if your browser supports the format.',
  DOWNLOAD_FAILED: 'Image download failed.',
  FILE_TOO_LARGE: 'Image file is too large. Please try with a smaller size.',
  CANVAS_TO_BLOB_FAILED: 'Failed to convert Canvas to Blob. Please check if your browser supports the format.',
  IMAGE_LOAD_FAILED: 'Failed to load image. Please check your image file or network status.',
  BLOB_TO_ARRAYBUFFER_FAILED: 'Failed to convert Blob to ArrayBuffer.',
  BLOB_CONVERSION_ERROR: 'An error occurred during Blob conversion. Please try again.',
  MULTIPLE_RESIZE_NOT_ALLOWED: 'resize() can only be called once. Please create a new processImage() instance.',
  CANVAS_CONTEXT_ERROR: 'Cannot create Canvas 2D context. Please check browser support.',

  // Size/dimension-related errors
  INVALID_DIMENSIONS: 'Invalid image dimensions. Width and height must be positive numbers.',
  DIMENSION_TOO_LARGE: 'Image dimensions are too large. Please try with a smaller size.',

  // System resource-related errors
  MEMORY_ERROR: 'Insufficient memory to complete image processing.',
  TIMEOUT_ERROR: 'Image processing is taking too long. Please try with a smaller image or different options.',

  // Browser compatibility errors
  BROWSER_NOT_SUPPORTED: 'This feature is not supported in your current browser. Please use a modern browser.',
  FEATURE_NOT_SUPPORTED: 'The requested feature is not supported in the current environment.',
};

/**
 * Solution suggestions
 */
const SOLUTION_SUGGESTIONS: Record<ImageErrorCodeType, string[]> = {
  INVALID_SOURCE: [
    'Use HTMLImageElement, Blob, or valid URL/Data URL',
    'If CORS issue, check crossOrigin settings',
    'For Base64 Data URL, verify correct format',
  ],

  UNSUPPORTED_FORMAT: [
    'Use standard formats like JPEG, PNG, WebP',
    'For modern formats like AVIF or HEIC, check browser support',
    'For SVG, convert to raster image first',
  ],

  SOURCE_LOAD_FAILED: [
    'Check your network connection status',
    'Verify that the image URL is accessible',
    'If blocked by CORS policy, check server configuration',
  ],

  CANVAS_CREATION_FAILED: [
    'Use a browser that supports Canvas API',
    'Try with a smaller image if memory is insufficient',
    'Some features may be limited in private/incognito mode',
  ],

  CANVAS_CONTEXT_FAILED: [
    'Try refreshing the browser or using a different browser',
    'Too many WebGL contexts may have been used',
    'Hardware acceleration may be disabled',
  ],

  PROCESSING_FAILED: [
    'Check if the image file is corrupted',
    'Try with different options',
    'Test with a smaller image',
  ],

  SMART_RESIZE_FAILED: [
    'For large images, try with a smaller size',
    'Increase memory limits or use progressive processing',
    'Try setting strategy option to "memory-efficient"',
  ],

  CONVERSION_FAILED: [
    'Try a different output format (PNG, JPEG, etc.)',
    'Reduce the image size',
    'Lower the quality setting (0.1-1.0 range)',
  ],

  FILE_TOO_LARGE: [
    'Reduce image size or lower quality',
    'Use a more efficient format like WebP',
    'Process in multiple steps',
  ],

  BROWSER_NOT_SUPPORTED: [
    'Use Chrome, Firefox, Safari, or Edge',
    'For WebP support, use Chrome 32+ or Firefox 65+',
  ],

  // Basic solutions
  RESIZE_FAILED: ['Check image size and try with smaller values'],
  BLUR_FAILED: ['Try with smaller blur radius'],
  OUTPUT_FAILED: ['Try a different output format'],
  DOWNLOAD_FAILED: ['Check browser popup blocking settings'],
  CANVAS_TO_BLOB_FAILED: [
    'Try a different image format (PNG, JPEG, etc.)',
    'Refresh the browser and try again',
    'Adjust quality settings',
  ],
  IMAGE_LOAD_FAILED: [
    'Check if the image file is corrupted',
    'Check network connection status',
    'Check CORS settings or permission issues',
  ],
  BLOB_TO_ARRAYBUFFER_FAILED: [
    'Try with smaller image if memory is insufficient',
    'Refresh the browser and try again',
  ],

  // SVG-related solutions
  SVG_LOAD_FAILED: [
    'Verify that SVG syntax is correct',
    'Check if xmlns namespace is included',
    'Verify that SVG file has complete structure',
  ],
  SVG_PROCESSING_FAILED: [
    'Try normalizing SVG content and retry',
    'For complex SVGs, try simplifying the structure',
    'Explicitly specify SVG size information (width, height, viewBox)',
  ],

  // Size/dimension-related solutions
  INVALID_DIMENSIONS: [
    'Verify that width and height are positive numbers',
    'Check that size values are not 0 or negative',
    'Round decimal values to integers if needed',
  ],
  DIMENSION_TOO_LARGE: [
    'Reduce image size (recommended: 4096x4096 or smaller)',
    'For large images with high memory usage, process progressively',
    'Check browser Canvas size limitations',
  ],

  // System resource-related solutions
  MEMORY_ERROR: [
    'Try with smaller image',
    'Refresh the browser to free up memory',
    'Close other tabs to free up memory',
    'Process image in multiple steps',
  ],
  TIMEOUT_ERROR: [
    'Try with smaller image',
    'Simplify processing options',
    'Check network connection status',
    'Check browser performance and pause other tasks',
  ],

  FEATURE_NOT_SUPPORTED: ['Try using a different approach or polyfill'],

  BLOB_CONVERSION_ERROR: [
    'Refresh the browser and try again',
    'Try with smaller image if memory is insufficient',
  ],

  MULTIPLE_RESIZE_NOT_ALLOWED: [
    'Create a new processImage() instance',
    'Set all options with a single resize() call',
    'Process each size separately if multiple sizes are needed',
  ],

  CANVAS_CONTEXT_ERROR: [
    'Use a browser that supports Canvas API',
    'Refresh the browser and try again',
    'Try a different browser or incognito mode',
  ],
};

/**
 * Development mode detection
 */
function isDevelopmentMode(): boolean {
  return (
    process?.env?.NODE_ENV === 'development' ||
    (typeof window !== 'undefined' && window.location?.hostname === 'localhost')
  );
}

/**
 * Error creation helper
 *
 * @description Creates errors with user-friendly messages and solutions
 */
export function createImageError(
  code: ImageErrorCodeType,
  originalError?: Error,
  context?: ErrorContext
): ImageProcessError {
  const userMessage = USER_FRIENDLY_MESSAGES[code];
  const suggestions = SOLUTION_SUGGESTIONS[code] || [];

  // Provide more detailed information in development mode
  let message = userMessage;
  if (isDevelopmentMode() && originalError) {
    message += `\n\n🔧 Developer Info: ${originalError.message}`;
  }

  if (suggestions.length > 0) {
    message += '\n\n💡 Solutions:';
    suggestions.forEach((suggestion, index) => {
      message += `\n${index + 1}. ${suggestion}`;
    });
  }

  // Add context information
  if (context && isDevelopmentMode()) {
    message += '\n\n📋 Context:';
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) {
        message += `\n- ${key}: ${JSON.stringify(value)}`;
      }
    });
  }

  const error = new ImageProcessError(message, code, originalError);

  // Attach context to error object
  if (context) {
    (error as any).context = context;
  }

  return error;
}

/**
 * Error recovery attempt
 *
 * @description Wrapper function that attempts fallback function on failure
 */
export async function withErrorRecovery<T>(
  primaryFunction: () => Promise<T>,
  fallbackFunction?: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  try {
    return await primaryFunction();
  } catch (error) {
    // Attempt fallback
    if (fallbackFunction) {
      try {
        console.warn('Primary method failed, trying fallback:', error);
        return await fallbackFunction();
      } catch (fallbackError) {
        // Provide more detailed error when both methods fail
        throw createImageError('CONVERSION_FAILED', fallbackError as Error, {
          ...context,
          debug: {
            primaryError: (error as Error).message,
            fallbackError: (fallbackError as Error).message,
          },
        });
      }
    }

    // Wrap if not ImageProcessError
    if (!(error instanceof ImageProcessError)) {
      throw createImageError('CONVERSION_FAILED', error as Error, context);
    }

    throw error;
  }
}

/**
 * Browser feature support check
 */
export function checkBrowserSupport(): {
  canvas: boolean;
  webp: boolean;
  avif: boolean;
  offscreenCanvas: boolean;
} {
  const canvas = document.createElement('canvas');

  return {
    canvas: !!(canvas.getContext && canvas.getContext('2d')),
    webp: canvas.toDataURL('image/webp').startsWith('data:image/webp'),
    avif: canvas.toDataURL('image/avif').startsWith('data:image/avif'),
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
  };
}

/**
 * Format support check
 */
export async function isFormatSupported(format: string): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(!!blob), `image/${format}`, 0.8);
  });
}

/**
 * Memory usage estimation
 */
export function estimateMemoryUsage(
  width: number,
  height: number
): {
  bytes: number;
  megabytes: number;
  warning: boolean;
} {
  // RGBA 4 bytes × width × height
  const bytes = width * height * 4;
  const megabytes = bytes / (1024 * 1024);

  // Warning for 100MB or more
  const warning = megabytes > 100;

  return { bytes, megabytes, warning };
}

/**
 * Error logging (development mode only)
 */
export function logError(error: ImageProcessError, context?: any): void {
  if (!isDevelopmentMode()) return;

  console.group('🚨 ImageProcessError');
  console.error('Code:', error.code);
  console.error('Message:', error.message);

  if (error.originalError) {
    console.error('Original Error:', error.originalError);
  }

  if (context) {
    console.error('Context:', context);
  }

  console.trace('Stack Trace');
  console.groupEnd();
}

/**
 * Enhanced error creation and handling
 *
 * @description Error creation integrated with centralized handler
 */
export async function createAndHandleError(
  code: ImageErrorCodeType,
  originalError?: Error,
  operation?: string,
  context?: ErrorContext
): Promise<ImageProcessError> {
  // Collect enhanced context
  const enhancedContext = globalErrorHandler.collectEnhancedContext(operation || 'unknown', context);

  // Use existing createImageError
  const error = createImageError(code, originalError, enhancedContext);

  // Handle with centralized handler
  await globalErrorHandler.handleError(error, enhancedContext);

  return error;
}

/**
 * Node.js best practice - async error handling wrapper
 *
 * @description Utility to simplify try-catch handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Partial<ErrorContext>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Wrap if not ImageProcessError
    if (!(error instanceof ImageProcessError)) {
      const wrappedError = await createAndHandleError(
        'PROCESSING_FAILED',
        error instanceof Error ? error : new Error(String(error)),
        operationName,
        context
      );
      throw wrappedError;
    }

    // Additional handling for existing ImageProcessError
    await globalErrorHandler.handleError(error, context);
    throw error;
  }
}

/**
 * Simple error creation (without handler)
 */
export function createQuickError(code: ImageErrorCodeType, originalError?: Error): ImageProcessError {
  return createImageError(code, originalError, { debug: { quickError: true } });
}

/**
 * Error statistics query function
 */
export function getErrorStats() {
  return globalErrorHandler.getStats();
}
