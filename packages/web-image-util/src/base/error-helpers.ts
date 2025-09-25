/**
 * 에러 처리 도우미 함수들
 *
 * @description 사용자 친화적인 에러 메시지와 해결 방법을 제공
 */

import { ImageProcessError, type ImageErrorCode } from '../types';

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
  /** 추가 디버그 정보 */
  debug?: Record<string, any>;
}

/**
 * 사용자 친화적 에러 메시지 매핑
 */
const USER_FRIENDLY_MESSAGES: Record<ImageErrorCode, string> = {
  // 소스 관련 에러
  INVALID_SOURCE: '이미지 소스가 유효하지 않습니다. 올바른 이미지 파일이나 URL을 사용해주세요.',
  UNSUPPORTED_FORMAT: '지원하지 않는 이미지 포맷입니다. JPEG, PNG, WebP 등의 표준 포맷을 사용해주세요.',
  SOURCE_LOAD_FAILED: '이미지를 불러오는데 실패했습니다. 네트워크 연결이나 파일 경로를 확인해주세요.',

  // 처리 관련 에러
  CANVAS_CREATION_FAILED:
    '이미지 처리를 위한 Canvas를 생성할 수 없습니다. 브라우저가 Canvas를 지원하는지 확인해주세요.',
  RESIZE_FAILED: '이미지 리사이징에 실패했습니다. 이미지 크기나 포맷에 문제가 있을 수 있습니다.',
  CONVERSION_FAILED: '이미지 포맷 변환에 실패했습니다. 다른 포맷으로 시도해보세요.',
  BLUR_FAILED: '이미지 블러 효과 적용에 실패했습니다.',

  // 출력 관련 에러
  OUTPUT_FAILED: '이미지 출력에 실패했습니다. 브라우저가 해당 포맷을 지원하는지 확인해주세요.',
  DOWNLOAD_FAILED: '이미지 다운로드에 실패했습니다.',
  FILE_TOO_LARGE: '이미지 파일이 너무 큽니다. 더 작은 크기로 시도해보세요.',

  // 브라우저 호환성 에러
  BROWSER_NOT_SUPPORTED: '현재 브라우저에서는 이 기능을 지원하지 않습니다. 최신 브라우저를 사용해주세요.',
  FEATURE_NOT_SUPPORTED: '요청한 기능이 현재 환경에서 지원되지 않습니다.',
};

/**
 * 해결 방법 제안
 */
const SOLUTION_SUGGESTIONS: Record<ImageErrorCode, string[]> = {
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
    '최신 버전의 Chrome, Firefox, Safari, Edge를 사용하세요',
    'WebP 지원이 필요한 경우 Chrome 32+ 또는 Firefox 65+를 사용하세요',
  ],

  // 기본 해결 방법들
  RESIZE_FAILED: ['이미지 크기를 확인하고 더 작은 값으로 시도하세요'],
  BLUR_FAILED: ['블러 반지름을 더 작은 값으로 시도하세요'],
  OUTPUT_FAILED: ['다른 출력 포맷으로 시도하세요'],
  DOWNLOAD_FAILED: ['브라우저의 팝업 차단 설정을 확인하세요'],
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
 * 향상된 에러 생성 도우미
 *
 * @description 사용자 친화적 메시지와 해결 방법이 포함된 에러를 생성
 */
export function createImageError(
  code: ImageErrorCode,
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
 * @description 자동으로 대체 방법을 시도하는 래퍼 함수
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
