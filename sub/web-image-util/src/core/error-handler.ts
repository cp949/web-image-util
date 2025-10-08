/**
 * Centralized error handler - Node.js best practices
 *
 * @description Simple handler that processes all errors consistently
 */

import type { ErrorContext } from '../base/error-helpers';
import type { ImageErrorCodeType } from '../types';
import { ImageProcessError } from '../types';

// Re-export ImageProcessError class
export { ImageProcessError };

/**
 * Simple error statistics
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  lastErrorTime: number;
}

/**
 * Centralized error handler
 *
 * @description Simple error management following Node.js best practices
 */
export class ImageErrorHandler {
  private static instance: ImageErrorHandler;
  private stats: ErrorStats = {
    totalErrors: 0,
    errorsByCode: {},
    lastErrorTime: 0,
  };

  static getInstance(): ImageErrorHandler {
    if (!this.instance) {
      this.instance = new ImageErrorHandler();
    }
    return this.instance;
  }

  /**
   * Error handling - logging and statistics collection
   */
  async handleError(error: ImageProcessError, context?: ErrorContext): Promise<void> {
    // Update statistics
    this.updateStats(error);

    // Detailed logging in development environment
    if (this.isDevelopmentMode()) {
      this.logDeveloperError(error, context);
    }

    // Critical error detection and response
    if (this.isCriticalError(error)) {
      await this.handleCriticalError(error);
    }
  }

  /**
   * Enhanced context information collection
   */
  collectEnhancedContext(operation: string, additionalContext: Partial<ErrorContext> = {}): ErrorContext {
    const context: ErrorContext = {
      ...additionalContext,
      // Memory information
      ...this.getMemoryInfo(),
      // Performance information
      timestamp: Date.now(),
      // Browser information
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    return context;
  }

  /**
   * Error severity analysis
   */
  private isCriticalError(error: ImageProcessError): boolean {
    const criticalCodes: ImageErrorCodeType[] = [
      'CANVAS_CREATION_FAILED',
      'CANVAS_CONTEXT_FAILED',
      'BROWSER_NOT_SUPPORTED',
    ];

    return criticalCodes.includes(error.code);
  }

  /**
   * Developer-friendly error logging
   */
  private logDeveloperError(error: ImageProcessError, context?: ErrorContext): void {
    console.group(`🚨 ${error.name} [${error.code}]`);
    console.error('Message:', error.message);

    if (context) {
      console.info('Context:', this.formatContext(context));
    }

    if (error.originalError) {
      console.error('Original Error:', error.originalError);
    }

    console.error('Stack:', error.stack);
    console.groupEnd();
  }

  /**
   * Context information formatting
   */
  private formatContext(context: any): string {
    const filtered = Object.entries(context)
      .filter(([key, value]) => value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    return JSON.stringify(filtered, null, 2);
  }

  /**
   * Critical error handling
   */
  private async handleCriticalError(error: ImageProcessError): Promise<void> {
    console.error('🔥 Critical error detected:', error.code);

    // Clean up Canvas Pool (if available)
    try {
      const { CanvasPool } = await import('../base/canvas-pool');
      CanvasPool.getInstance().clear();
      console.info('Canvas pool cleared due to critical error');
    } catch {
      // Ignore even if Canvas Pool doesn't exist
    }

    // Attempt memory cleanup
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
      console.info('Garbage collection triggered');
    }
  }

  /**
   * Update statistics
   */
  private updateStats(error: ImageProcessError): void {
    this.stats.totalErrors++;
    this.stats.errorsByCode[error.code] = (this.stats.errorsByCode[error.code] || 0) + 1;
    this.stats.lastErrorTime = Date.now();
  }

  /**
   * Memory information collection
   */
  private getMemoryInfo(): Partial<ErrorContext> {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        debug: {
          memoryUsedMB: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
          memoryLimitMB: Math.round(memory.jsHeapSizeLimit / (1024 * 1024)),
          memoryPressure: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
        },
      };
    }
    return {};
  }

  /**
   * Development mode detection
   */
  private isDevelopmentMode(): boolean {
    return (
      process?.env?.NODE_ENV === 'development' ||
      (typeof window !== 'undefined' && window.location?.hostname === 'localhost')
    );
  }

  /**
   * Query error statistics
   */
  getStats(): ErrorStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalErrors: 0,
      errorsByCode: {},
      lastErrorTime: 0,
    };
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = ImageErrorHandler.getInstance();
