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
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .toBlob();
 *
 * // 고급 처리
 * const result = await processImage(source)
 *   .resize({ fit: 'contain', width: 300, height: 200, background: '#ffffff' })
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

// SVG 복잡도 분석
export { analyzeSvgComplexity } from './core/svg-complexity-analyzer';

// SVG 유틸리티 함수들
export { extractSvgDimensions } from './utils/svg-dimensions';

// 타입 정의
export type {
  // 입력 타입
  ImageSource,

  // 옵션 타입
  ResizeConfig,
  SmartResizeOptions,
  BlurOptions,
  OutputOptions,
  ProcessorOptions,
  Padding, // 🆕 Phase 1: Padding 타입 export

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

  // SVG 품질 시스템 타입들
  QualityLevel,
  SvgComplexityMetrics,
  ComplexityAnalysisResult,

  // SVG 유틸리티 타입들
  SvgDimensions,
} from './types';

// 에러 클래스
export { ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from './types';

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
