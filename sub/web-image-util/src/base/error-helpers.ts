/**
 * Error handling helper functions
 *
 * @description Provides user-friendly error messages and solutions
 */

import { globalErrorHandler } from '../core/error-handler';
import { type ImageErrorCodeType, type ImageErrorDetails, ImageProcessError } from '../types';

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
  SOURCE_BYTES_EXCEEDED: 'Image source is too large.',

  // Processing-related errors
  CANVAS_CREATION_FAILED: 'Cannot create Canvas for image processing. Please verify that your browser supports Canvas.',
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
  OPTION_INVALID: 'Invalid option value.',
  SVG_INPUT_INVALID: 'SVG input must be a string.',
  SVG_DOMPURIFY_INIT_FAILED: 'SVG sanitizer could not be initialized in this environment.',
  SVG_NODE_COUNT_EXCEEDED: 'SVG node count exceeds the allowed limit.',
  SVG_BYTES_EXCEEDED: 'SVG input exceeds the allowed size limit.',
  INVALID_DATA_URL: 'Invalid Data URL format.',
  INVALID_SVG_DATA_URL: 'Invalid SVG Data URL format.',
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
 * @description 사용자 친화적 메시지로 에러를 생성한다
 */
export function createImageError(
  code: ImageErrorCodeType,
  options?: { cause?: unknown; details?: ImageErrorDetails; context?: ErrorContext }
): ImageProcessError {
  const userMessage = USER_FRIENDLY_MESSAGES[code];
  let message = userMessage;

  if (isDevelopmentMode() && options?.cause instanceof Error) {
    message += `\n\n🔧 Developer Info: ${options.cause.message}`;
  }

  if (options?.context && isDevelopmentMode()) {
    message += '\n\n📋 Context:';
    Object.entries(options.context).forEach(([key, value]) => {
      if (value !== undefined) {
        message += `\n- ${key}: ${JSON.stringify(value)}`;
      }
    });
  }

  const error = new ImageProcessError(message, code, {
    cause: options?.cause,
    details: options?.details,
  });

  if (options?.context) {
    (error as any).context = options.context;
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
        // 두 방법 모두 실패했을 때 더 자세한 에러를 제공한다
        throw createImageError('CONVERSION_FAILED', {
          cause: fallbackError,
          context: {
            ...context,
            debug: {
              primaryError: (error as Error).message,
              fallbackError: (fallbackError as Error).message,
            },
          },
        });
      }
    }

    // ImageProcessError가 아니면 래핑한다
    if (!(error instanceof ImageProcessError)) {
      throw createImageError('CONVERSION_FAILED', { cause: error, context });
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
    canvas: !!canvas.getContext?.('2d'),
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

  if (error.cause instanceof Error) {
    console.error('Original Error:', error.cause);
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
  cause?: unknown,
  operation?: string,
  context?: ErrorContext
): Promise<ImageProcessError> {
  // Collect enhanced context
  const enhancedContext = globalErrorHandler.collectEnhancedContext(operation || 'unknown', context);

  // Use existing createImageError
  const error = createImageError(code, { cause, context: enhancedContext });

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
export function createQuickError(code: ImageErrorCodeType, cause?: unknown): ImageProcessError {
  return createImageError(code, { cause });
}

/**
 * Error statistics query function
 */
export function getErrorStats() {
  return globalErrorHandler.getStats();
}
