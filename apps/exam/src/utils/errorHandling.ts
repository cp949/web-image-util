// Error handling utility - leverages ImageProcessError

import { ImageProcessError } from '@cp949/web-image-util';

/**
 * Convert errors to user-friendly messages
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ImageProcessError) {
    switch (error.code) {
      case 'INVALID_SOURCE':
        return 'Unsupported image format. Please use JPG, PNG, WebP, or SVG files.';
      case 'SOURCE_LOAD_FAILED':
        return 'Failed to load image. The file may be corrupted or inaccessible.';
      case 'CANVAS_CREATION_FAILED':
        return 'An error occurred during image processing. Please refresh your browser.';
      case 'OUTPUT_FAILED':
        return 'Failed to generate result image. Please try a different format.';
      default:
        return `Image processing error: ${error.message}`;
    }
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return 'An unknown error occurred.';
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof ImageProcessError) {
    // OUTPUT_FAILED can be recovered by changing options
    return error.code === 'OUTPUT_FAILED';
  }
  return false;
}

/**
 * Check error severity
 */
export function getErrorSeverity(error: unknown): 'error' | 'warning' | 'info' {
  if (error instanceof ImageProcessError) {
    switch (error.code) {
      case 'CANVAS_CREATION_FAILED':
      case 'SOURCE_LOAD_FAILED':
        return 'error';
      case 'OUTPUT_FAILED':
        return 'warning';
      default:
        return 'info';
    }
  }
  return 'error';
}

/**
 * Error logging (development environment only)
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🔴 Error${context ? ` in ${context}` : ''}`);
    console.error(error);
    if (error instanceof ImageProcessError) {
      console.log('Error Code:', error.code);
      console.log('Error Message:', error.message);
    }
    console.groupEnd();
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format processing time
 */
export function formatProcessingTime(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}