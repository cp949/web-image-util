/**
 * @cp949/web-image-util
 *
 * 브라우저에서 이미지 처리를 위한 TypeScript 라이브러리
 * Canvas 2D API를 사용하여 고성능 이미지 변환 제공
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
 *   .resize(300, 200, { fit: 'contain', background: '#ffffff' })
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

// SVG 호환성 함수들
export { enhanceBrowserCompatibility, normalizeSvgBasics } from './utils/svg-compatibility';
export type { SvgCompatibilityOptions, SvgCompatibilityReport } from './utils/svg-compatibility';

// 타입 정의
export type {
  // 입력 타입
  ImageSource,

  // 옵션 타입
  ResizeOptions,
  BlurOptions,
  OutputOptions,
  ProcessorOptions,

  // 결과 타입
  ResultBlob,
  ResultDataURL,
  ResultFile,
  ResultMetadata,

  // 유틸리티 타입
  ResizeFit,
  ResizePosition,
  ResizeBackground,
  ImageFormat,
  ImageErrorCodeType,
} from './types';

// 에러 클래스
export { ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from './types';

/**
 * 라이브러리 버전 정보
 *
 * @description 현재 설치된 @cp949/web-image-util 라이브러리의 버전 번호
 * 시맨틱 버저닝을 따르며 메이저.마이너.패치 형식입니다.
 */
export const version = '2.0.0-alpha';

/**
 * 브라우저 기능 지원 여부 확인
 *
 * @description 현재 브라우저에서 지원하는 이미지 처리 기능들을 동적으로 감지합니다.
 * 런타임에 기능 가용성을 확인하여 최적의 처리 방식을 선택할 수 있습니다.
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
 * 라이브러리 기본 설정값
 *
 * @description 이미지 처리 시 사용되는 기본 매개변수들입니다.
 * 사용자가 별도로 지정하지 않을 경우 이 값들이 적용됩니다.
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
