// 통합 타입 시스템에서 import
import { ImageProcessError, ImageErrorCodeConstants } from '../types';

/**
 * 이미지 소스 로딩 에러
 *
 * @description 이미지 소스를 로드하는 과정에서 발생하는 에러
 * 잘못된 URL, 네트워크 오류, CORS 문제 등이 원인일 수 있습니다.
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
 * 이미지 변환 에러
 *
 * @description 이미지 포맷 변환 과정에서 발생하는 에러
 * 지원하지 않는 포맷이나 변환 실패가 원인일 수 있습니다.
 */
export class ImageConversionError extends ImageProcessError {
  constructor(message: string, fromFormat: string, toFormat: string, originalError?: Error) {
    super(`${message} (${fromFormat} → ${toFormat})`, ImageErrorCodeConstants.CONVERSION_FAILED, originalError);
    this.name = 'ImageConversionError';
  }
}

/**
 * Canvas 관련 에러
 *
 * @description Canvas 생성이나 2D 컨텍스트 획득 실패 시 발생하는 에러
 * 브라우저 지원 문제나 메모리 부족이 원인일 수 있습니다.
 */
export class ImageCanvasError extends ImageProcessError {
  constructor(message: string, originalError?: Error) {
    super(message, ImageErrorCodeConstants.CANVAS_CREATION_FAILED, originalError);
    this.name = 'ImageCanvasError';
  }
}

/**
 * 이미지 리사이징 에러
 *
 * @description 이미지 크기 조정 과정에서 발생하는 에러
 * 잘못된 크기 값이나 메모리 부족이 원인일 수 있습니다.
 */
export class ImageResizeError extends ImageProcessError {
  constructor(message: string, originalError?: Error) {
    super(message, ImageErrorCodeConstants.RESIZE_FAILED, originalError);
    this.name = 'ImageResizeError';
  }
}
