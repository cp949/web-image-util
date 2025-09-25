/**
 * @cp949/web-image-util
 *
 * 트리쉐이킹 친화적이고 사용하기 쉬운 이미지 처리 라이브러리
 * Sharp 라이브러리의 패턴을 참고하여 설계됨
 *
 * @example 기본 사용법
 * ```typescript
 * import { processImage } from '@cp949/web-image-util';
 *
 * // 간단한 리사이징
 * const thumbnail = await processImage(source)
 *   .resize(300, 200)
 *   .toBlob();
 *
 * // 고급 처리
 * const result = await processImage(source)
 *   .resize(300, 200, { fit: 'pad', background: '#ffffff' })
 *   .blur(2)
 *   .toBlob({ format: 'webp', quality: 0.8 });
 * ```
 */

// 핵심 API
export { processImage, ImageProcessor } from './processor';

// 편의성 기능들
export { createThumbnail, createAvatar, createSocialImage } from './presets';
export type { ThumbnailOptions, AvatarOptions, SocialImageOptions, SocialPlatform } from './presets';

// 유틸리티 함수들
export { toBlob, toBlobDetailed, toDataURL, toDataURLDetailed, toFile, toFileDetailed } from './utils';
export type {
  BlobOptions,
  BlobDetailedOptions,
  DataURLOptions,
  DataURLDetailedOptions,
  FileOptions,
  FileDetailedOptions,
} from './utils';

// 타입 정의
export type {
  // 입력 타입
  ImageSource,

  // 옵션 타입
  ResizeOptions,
  AtMostOptions,
  BlurOptions,
  OutputOptions,
  ProcessorOptions,

  // 결과 타입
  BlobResult,
  DataURLResult,
  FileResult,
  ProcessResult,

  // 유틸리티 타입
  ResizeFit,
  ResizePosition,
  BackgroundColor,
  ImageFormat,
  ImageErrorCode,
} from './types';

// 에러 클래스
export { ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from './types';

/**
 * 라이브러리 정보
 */
export const version = '2.0.0-alpha';

/**
 * 지원하는 기능 확인
 */
export const features = {
  /** WebP 지원 여부 */
  webp: (() => {
    try {
      const canvas = document.createElement('canvas');
      return canvas.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      return false;
    }
  })(),

  /** AVIF 지원 여부 */
  avif: (() => {
    try {
      const canvas = document.createElement('canvas');
      return canvas.toDataURL('image/avif').startsWith('data:image/avif');
    } catch {
      return false;
    }
  })(),

  /** OffscreenCanvas 지원 여부 */
  offscreenCanvas: typeof OffscreenCanvas !== 'undefined',

  /** ImageBitmap 지원 여부 */
  imageBitmap: typeof createImageBitmap !== 'undefined',
} as const;

/**
 * 기본 설정
 */
export const defaults = {
  /** 기본 품질 (0.0 - 1.0) */
  quality: 0.8,

  /** 기본 리사이징 fit 방식 */
  fit: 'cover' as const,

  /** 기본 배경색 (투명) */
  background: { r: 0, g: 0, b: 0, alpha: 0 },

  /** 기본 블러 반지름 */
  blurRadius: 2,

  /** 기본 출력 포맷 */
  format: 'png' as const,
} as const;

// ❌ export * 금지 - 트리쉐이킹 방해
// ❌ 내부 유틸리티 export 금지 - API 오염 방지
// ❌ 개발용 함수 export 금지 - 프로덕션 번들 최적화
