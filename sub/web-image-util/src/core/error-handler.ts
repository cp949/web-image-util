/**
 * 중앙집중식 에러 핸들러 - Node.js 베스트 프랙티스
 *
 * @description 모든 에러를 일관되게 처리하는 간단한 핸들러
 */

import type { ErrorContext } from '../base/error-helpers';
import type { ImageErrorCodeType } from '../types';
import { ImageProcessError } from '../types';

// ImageProcessError 클래스를 다시 export
export { ImageProcessError };

/**
 * 간단한 에러 통계
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  lastErrorTime: number;
}

/**
 * 중앙집중식 에러 핸들러
 *
 * @description Node.js 베스트 프랙티스를 따른 간단한 에러 관리
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
   * 에러 처리 - 로깅과 통계 수집
   */
  async handleError(error: ImageProcessError, context?: ErrorContext): Promise<void> {
    // 통계 업데이트
    this.updateStats(error);

    // 개발 환경에서 상세 로깅
    if (this.isDevelopmentMode()) {
      this.logDeveloperError(error, context);
    }

    // 치명적 에러 감지 및 대응
    if (this.isCriticalError(error)) {
      await this.handleCriticalError(error);
    }
  }

  /**
   * 향상된 컨텍스트 정보 수집
   */
  collectEnhancedContext(operation: string, additionalContext: Partial<ErrorContext> = {}): ErrorContext {
    const context: ErrorContext = {
      ...additionalContext,
      // 메모리 정보
      ...this.getMemoryInfo(),
      // 성능 정보
      timestamp: Date.now(),
      // 브라우저 정보
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    return context;
  }

  /**
   * 에러 심각도 분석
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
   * 개발자 친화적 에러 로깅
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
   * 컨텍스트 정보 포맷팅
   */
  private formatContext(context: any): string {
    const filtered = Object.entries(context)
      .filter(([key, value]) => value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    return JSON.stringify(filtered, null, 2);
  }

  /**
   * 치명적 에러 처리
   */
  private async handleCriticalError(error: ImageProcessError): Promise<void> {
    console.error('🔥 Critical error detected:', error.code);

    // Canvas Pool 정리 (있는 경우)
    try {
      const { CanvasPool } = await import('../base/canvas-pool');
      CanvasPool.getInstance().clear();
      console.info('Canvas pool cleared due to critical error');
    } catch {
      // Canvas Pool이 없어도 무시
    }

    // 메모리 정리 시도
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
      console.info('Garbage collection triggered');
    }
  }

  /**
   * 통계 업데이트
   */
  private updateStats(error: ImageProcessError): void {
    this.stats.totalErrors++;
    this.stats.errorsByCode[error.code] = (this.stats.errorsByCode[error.code] || 0) + 1;
    this.stats.lastErrorTime = Date.now();
  }

  /**
   * 메모리 정보 수집
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
   * 개발 모드 감지
   */
  private isDevelopmentMode(): boolean {
    return (
      process?.env?.NODE_ENV === 'development' ||
      (typeof window !== 'undefined' && window.location?.hostname === 'localhost')
    );
  }

  /**
   * 에러 통계 조회
   */
  getStats(): ErrorStats {
    return { ...this.stats };
  }

  /**
   * 통계 초기화
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
 * 전역 에러 핸들러 인스턴스
 */
export const globalErrorHandler = ImageErrorHandler.getInstance();
