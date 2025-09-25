/**
 * 기본 이미지 처리 에러 클래스
 */
export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public code: ImageErrorCode,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ImageProcessingError';

    // Error 스택 추적을 위한 설정
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ImageProcessingError);
    }
  }
}

/**
 * 에러 코드 정의
 */
export type ImageErrorCode =
  // 소스 관련 에러
  | 'INVALID_SOURCE'
  | 'UNSUPPORTED_FORMAT'
  | 'SOURCE_LOAD_FAILED'
  // 처리 관련 에러
  | 'CANVAS_CREATION_FAILED'
  | 'RESIZE_FAILED'
  | 'CONVERSION_FAILED'
  // 파일 관련 에러
  | 'DOWNLOAD_FAILED'
  | 'FILE_TOO_LARGE'
  // 브라우저 호환성 에러
  | 'BROWSER_NOT_SUPPORTED'
  | 'FEATURE_NOT_SUPPORTED';

export const ImageErrorCode = {
  // 소스 관련 에러
  INVALID_SOURCE: 'INVALID_SOURCE' as const,
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT' as const,
  SOURCE_LOAD_FAILED: 'SOURCE_LOAD_FAILED' as const,
  // 처리 관련 에러
  CANVAS_CREATION_FAILED: 'CANVAS_CREATION_FAILED' as const,
  RESIZE_FAILED: 'RESIZE_FAILED' as const,
  CONVERSION_FAILED: 'CONVERSION_FAILED' as const,
  // 파일 관련 에러
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED' as const,
  FILE_TOO_LARGE: 'FILE_TOO_LARGE' as const,
  // 브라우저 호환성 에러
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED' as const,
  FEATURE_NOT_SUPPORTED: 'FEATURE_NOT_SUPPORTED' as const,
} as const;

/**
 * 소스 로딩 에러
 */
export class ImageSourceError extends ImageProcessingError {
  constructor(
    message: string,
    public source: any,
    originalError?: Error
  ) {
    super(message, ImageErrorCode.SOURCE_LOAD_FAILED, originalError);
    this.name = 'ImageSourceError';
  }
}

/**
 * 변환 에러
 */
export class ImageConversionError extends ImageProcessingError {
  constructor(message: string, fromFormat: string, toFormat: string, originalError?: Error) {
    super(`${message} (${fromFormat} → ${toFormat})`, ImageErrorCode.CONVERSION_FAILED, originalError);
    this.name = 'ImageConversionError';
  }
}

/**
 * Canvas 관련 에러
 */
export class ImageCanvasError extends ImageProcessingError {
  constructor(message: string, originalError?: Error) {
    super(message, ImageErrorCode.CANVAS_CREATION_FAILED, originalError);
    this.name = 'ImageCanvasError';
  }
}

/**
 * 리사이징 에러
 */
export class ImageResizeError extends ImageProcessingError {
  constructor(message: string, originalError?: Error) {
    super(message, ImageErrorCode.RESIZE_FAILED, originalError);
    this.name = 'ImageResizeError';
  }
}
