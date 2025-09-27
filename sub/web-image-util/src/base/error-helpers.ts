/**
 * 에러 처리 도우미 함수들
 *
 * @description 사용자 친화적인 에러 메시지와 해결 방법을 제공
 */

import { ImageProcessError, type ImageErrorCodeType } from '../types';
import { globalErrorHandler, type ErrorStats } from '../core/error-handler';

/**
 * 에러 컨텍스트 정보
 */
export interface ErrorContext {
  /** 작업중이던 소스 타입 */
  sourceType?: string;
  /** 시도한 포맷 */
  format?: string;
  /** 이미지 크기 정보 */
  dimensions?: { width: number; height: number };
  /** 브라우저 정보 */
  userAgent?: string;
  /** 타임스탬프 */
  timestamp?: number;
  /** 추가 디버그 정보 */
  debug?: Record<string, any>;
}

/**
 * 사용자 친화적 에러 메시지 매핑
 */
const USER_FRIENDLY_MESSAGES: Record<ImageErrorCodeType, string> = {
  // 소스 관련 에러
  INVALID_SOURCE: '이미지 소스가 유효하지 않습니다. 올바른 이미지 파일이나 URL을 사용해주세요.',
  UNSUPPORTED_FORMAT: '지원하지 않는 이미지 포맷입니다. JPEG, PNG, WebP 등의 표준 포맷을 사용해주세요.',
  SOURCE_LOAD_FAILED: '이미지를 불러오는데 실패했습니다. 네트워크 연결이나 파일 경로를 확인해주세요.',

  // 처리 관련 에러
  CANVAS_CREATION_FAILED:
    '이미지 처리를 위한 Canvas를 생성할 수 없습니다. 브라우저가 Canvas를 지원하는지 확인해주세요.',
  CANVAS_CONTEXT_FAILED: 'Canvas 2D 컨텍스트를 가져올 수 없습니다. 브라우저가 Canvas API를 지원하는지 확인해주세요.',
  RESIZE_FAILED: '이미지 리사이징에 실패했습니다. 이미지 크기나 포맷에 문제가 있을 수 있습니다.',
  CONVERSION_FAILED: '이미지 포맷 변환에 실패했습니다. 다른 포맷으로 시도해보세요.',
  BLUR_FAILED: '이미지 블러 효과 적용에 실패했습니다.',
  PROCESSING_FAILED: '이미지 처리 중 오류가 발생했습니다. 이미지 파일이나 옵션을 확인해주세요.',
  SMART_RESIZE_FAILED: '스마트 리사이징 중 오류가 발생했습니다. 대용량 이미지인 경우 더 작은 크기로 시도해보세요.',

  // SVG 관련 에러
  SVG_LOAD_FAILED: 'SVG 이미지를 불러오는데 실패했습니다. SVG 구문이 올바른지 확인해주세요.',
  SVG_PROCESSING_FAILED: 'SVG 이미지 처리 중 오류가 발생했습니다. SVG 파일이 손상되었을 수 있습니다.',

  // 출력 관련 에러
  OUTPUT_FAILED: '이미지 출력에 실패했습니다. 브라우저가 해당 포맷을 지원하는지 확인해주세요.',
  DOWNLOAD_FAILED: '이미지 다운로드에 실패했습니다.',
  FILE_TOO_LARGE: '이미지 파일이 너무 큽니다. 더 작은 크기로 시도해보세요.',
  CANVAS_TO_BLOB_FAILED: 'Canvas를 Blob으로 변환하는데 실패했습니다. 브라우저가 해당 포맷을 지원하는지 확인해주세요.',
  IMAGE_LOAD_FAILED: '이미지를 로드하는데 실패했습니다. 이미지 파일이나 네트워크 상태를 확인해주세요.',
  BLOB_TO_ARRAYBUFFER_FAILED: 'Blob을 ArrayBuffer로 변환하는데 실패했습니다.',

  // 크기/차원 관련 에러
  INVALID_DIMENSIONS: '이미지 크기가 유효하지 않습니다. 너비와 높이는 양수여야 합니다.',
  DIMENSION_TOO_LARGE: '이미지 크기가 너무 큽니다. 더 작은 크기로 시도해주세요.',

  // 시스템 자원 관련 에러
  MEMORY_ERROR: '메모리가 부족하여 이미지 처리를 완료할 수 없습니다.',
  TIMEOUT_ERROR: '이미지 처리 시간이 너무 오래 걸립니다. 더 작은 이미지나 다른 옵션을 시도해주세요.',

  // 브라우저 호환성 에러
  BROWSER_NOT_SUPPORTED: '현재 브라우저에서는 이 기능을 지원하지 않습니다. 최신 브라우저를 사용해주세요.',
  FEATURE_NOT_SUPPORTED: '요청한 기능이 현재 환경에서 지원되지 않습니다.',
};

/**
 * 해결 방법 제안
 */
const SOLUTION_SUGGESTIONS: Record<ImageErrorCodeType, string[]> = {
  INVALID_SOURCE: [
    'HTMLImageElement, Blob, 또는 유효한 URL/Data URL을 사용하세요',
    'CORS 문제인 경우 crossOrigin 설정을 확인하세요',
    'Base64 Data URL인 경우 올바른 형식인지 확인하세요',
  ],

  UNSUPPORTED_FORMAT: [
    'JPEG, PNG, WebP 등의 표준 포맷을 사용하세요',
    'AVIF나 HEIC 같은 최신 포맷은 브라우저 지원을 확인하세요',
    'SVG의 경우 먼저 래스터 이미지로 변환하세요',
  ],

  SOURCE_LOAD_FAILED: [
    '네트워크 연결 상태를 확인하세요',
    '이미지 URL이 접근 가능한지 확인하세요',
    'CORS 정책으로 차단된 경우 서버 설정을 확인하세요',
  ],

  CANVAS_CREATION_FAILED: [
    'Canvas API를 지원하는 브라우저를 사용하세요',
    '메모리가 부족할 수 있으니 더 작은 이미지로 시도하세요',
    'private/incognito 모드에서는 일부 기능이 제한될 수 있습니다',
  ],

  CANVAS_CONTEXT_FAILED: [
    '브라우저를 새로고침하거나 다른 브라우저를 시도해보세요',
    'WebGL 컨텍스트가 너무 많이 사용되었을 수 있습니다',
    '하드웨어 가속이 비활성화되었을 수 있습니다',
  ],

  PROCESSING_FAILED: [
    '이미지 파일이 손상되었는지 확인해보세요',
    '다른 옵션으로 시도해보세요',
    '더 작은 이미지로 테스트해보세요',
  ],

  SMART_RESIZE_FAILED: [
    '대용량 이미지인 경우 더 작은 크기로 시도해보세요',
    '메모리 제한을 늘리거나 단계적 처리를 사용하세요',
    'strategy 옵션을 "memory-efficient"로 설정해보세요',
  ],

  CONVERSION_FAILED: [
    '다른 출력 포맷을 시도해보세요 (PNG, JPEG 등)',
    '이미지 크기를 줄여보세요',
    '품질 설정을 낮춰보세요 (0.1-1.0 범위)',
  ],

  FILE_TOO_LARGE: [
    '이미지 크기를 줄이거나 품질을 낮춰보세요',
    '더 효율적인 포맷(WebP)을 사용해보세요',
    '여러 단계로 나누어 처리해보세요',
  ],

  BROWSER_NOT_SUPPORTED: [
    'Chrome, Firefox, Safari, Edge를 사용하세요',
    'WebP 지원이 필요한 경우 Chrome 32+ 또는 Firefox 65+를 사용하세요',
  ],

  // 기본 해결 방법들
  RESIZE_FAILED: ['이미지 크기를 확인하고 더 작은 값으로 시도하세요'],
  BLUR_FAILED: ['블러 반지름을 더 작은 값으로 시도하세요'],
  OUTPUT_FAILED: ['다른 출력 포맷으로 시도하세요'],
  DOWNLOAD_FAILED: ['브라우저의 팝업 차단 설정을 확인하세요'],
  CANVAS_TO_BLOB_FAILED: [
    '다른 이미지 포맷을 시도해보세요 (PNG, JPEG 등)',
    '브라우저를 새로고침하고 다시 시도하세요',
    '품질 설정을 조정해보세요',
  ],
  IMAGE_LOAD_FAILED: [
    '이미지 파일이 손상되었는지 확인하세요',
    '네트워크 연결 상태를 확인하세요',
    'CORS 설정이나 권한 문제를 확인하세요',
  ],
  BLOB_TO_ARRAYBUFFER_FAILED: [
    '메모리가 부족할 수 있으니 더 작은 이미지로 시도하세요',
    '브라우저를 새로고침하고 다시 시도하세요',
  ],

  // SVG 관련 해결책
  SVG_LOAD_FAILED: [
    'SVG 문법이 올바른지 확인하세요',
    'xmlns 네임스페이스가 포함되어 있는지 확인하세요',
    'SVG 파일이 완전한 구조를 가지고 있는지 확인하세요',
  ],
  SVG_PROCESSING_FAILED: [
    'SVG 내용을 정규화하여 다시 시도하세요',
    '복잡한 SVG인 경우 간단한 구조로 변경해보세요',
    'SVG 크기 정보(width, height, viewBox)를 명시적으로 지정하세요',
  ],

  // 크기/차원 관련 해결책
  INVALID_DIMENSIONS: [
    '너비와 높이가 양수인지 확인하세요',
    '크기 값이 0이거나 음수가 아닌지 확인하세요',
    '소수점이 있는 경우 정수로 반올림하세요',
  ],
  DIMENSION_TOO_LARGE: [
    '이미지 크기를 줄여보세요 (권장: 4096x4096 이하)',
    '메모리 사용량이 많은 대용량 이미지는 단계적으로 처리하세요',
    '브라우저의 Canvas 크기 제한을 확인하세요',
  ],

  // 시스템 자원 관련 해결책
  MEMORY_ERROR: [
    '더 작은 이미지로 시도해보세요',
    '브라우저를 새로고침하여 메모리를 정리하세요',
    '다른 탭을 닫아 메모리를 확보하세요',
    '이미지를 여러 단계로 나누어 처리하세요',
  ],
  TIMEOUT_ERROR: [
    '더 작은 이미지로 시도해보세요',
    '처리 옵션을 간단하게 설정하세요',
    '네트워크 연결 상태를 확인하세요',
    '브라우저 성능을 확인하고 다른 작업을 일시 중단하세요',
  ],

  FEATURE_NOT_SUPPORTED: ['다른 방법이나 polyfill을 사용해보세요'],
};

/**
 * 개발자 모드 감지
 */
function isDevelopmentMode(): boolean {
  return (
    process?.env?.NODE_ENV === 'development' ||
    (typeof window !== 'undefined' && window.location?.hostname === 'localhost')
  );
}

/**
 * 에러 생성 도우미
 *
 * @description 사용자 친화적 메시지와 해결 방법이 포함된 에러를 생성
 */
export function createImageError(
  code: ImageErrorCodeType,
  originalError?: Error,
  context?: ErrorContext
): ImageProcessError {
  const userMessage = USER_FRIENDLY_MESSAGES[code];
  const suggestions = SOLUTION_SUGGESTIONS[code] || [];

  // 개발자 모드에서는 더 상세한 정보 제공
  let message = userMessage;
  if (isDevelopmentMode() && originalError) {
    message += `\n\n🔧 개발자 정보: ${originalError.message}`;
  }

  if (suggestions.length > 0) {
    message += '\n\n💡 해결 방법:';
    suggestions.forEach((suggestion, index) => {
      message += `\n${index + 1}. ${suggestion}`;
    });
  }

  // 컨텍스트 정보 추가
  if (context && isDevelopmentMode()) {
    message += '\n\n📋 컨텍스트:';
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) {
        message += `\n- ${key}: ${JSON.stringify(value)}`;
      }
    });
  }

  const error = new ImageProcessError(message, code, originalError);

  // 컨텍스트를 에러 객체에 첨부
  if (context) {
    (error as any).context = context;
  }

  return error;
}

/**
 * 에러 복구 시도
 *
 * @description 실패시 fallback 함수를 시도하는 래퍼 함수
 */
export async function withErrorRecovery<T>(
  primaryFunction: () => Promise<T>,
  fallbackFunction?: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  try {
    return await primaryFunction();
  } catch (error) {
    // Fallback 시도
    if (fallbackFunction) {
      try {
        console.warn('Primary method failed, trying fallback:', error);
        return await fallbackFunction();
      } catch (fallbackError) {
        // 두 방법 모두 실패한 경우 더 상세한 에러 제공
        throw createImageError('CONVERSION_FAILED', fallbackError as Error, {
          ...context,
          debug: {
            primaryError: (error as Error).message,
            fallbackError: (fallbackError as Error).message,
          },
        });
      }
    }

    // ImageProcessError가 아닌 경우 래핑
    if (!(error instanceof ImageProcessError)) {
      throw createImageError('CONVERSION_FAILED', error as Error, context);
    }

    throw error;
  }
}

/**
 * 브라우저 기능 지원 확인
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
 * 포맷 지원 여부 확인
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
 * 메모리 사용량 추정
 */
export function estimateMemoryUsage(
  width: number,
  height: number
): {
  bytes: number;
  megabytes: number;
  warning: boolean;
} {
  // RGBA 4바이트 × 너비 × 높이
  const bytes = width * height * 4;
  const megabytes = bytes / (1024 * 1024);

  // 100MB 이상은 경고
  const warning = megabytes > 100;

  return { bytes, megabytes, warning };
}

/**
 * 에러 로깅 (개발 모드에서만)
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
 * 향상된 에러 생성 및 처리
 *
 * @description 중앙집중식 핸들러와 통합된 에러 생성
 */
export async function createAndHandleError(
  code: ImageErrorCodeType,
  originalError?: Error,
  operation?: string,
  context?: ErrorContext
): Promise<ImageProcessError> {
  // 향상된 컨텍스트 수집
  const enhancedContext = globalErrorHandler.collectEnhancedContext(operation || 'unknown', context);

  // 기존 createImageError 사용
  const error = createImageError(code, originalError, enhancedContext);

  // 중앙집중식 핸들러로 처리
  await globalErrorHandler.handleError(error, enhancedContext);

  return error;
}

/**
 * Node.js 베스트 프랙티스 - async 에러 처리 래퍼
 *
 * @description try-catch를 간편하게 만드는 유틸리티
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Partial<ErrorContext>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // ImageProcessError가 아닌 경우 래핑
    if (!(error instanceof ImageProcessError)) {
      const wrappedError = await createAndHandleError(
        'PROCESSING_FAILED',
        error instanceof Error ? error : new Error(String(error)),
        operationName,
        context
      );
      throw wrappedError;
    }

    // 이미 ImageProcessError인 경우 추가 처리
    await globalErrorHandler.handleError(error, context);
    throw error;
  }
}

/**
 * 간단한 에러 생성 (핸들러 없이)
 */
export function createQuickError(code: ImageErrorCodeType, originalError?: Error): ImageProcessError {
  return createImageError(code, originalError, { debug: { quickError: true } });
}

/**
 * 에러 통계 조회 함수
 */
export function getErrorStats() {
  return globalErrorHandler.getStats();
}
