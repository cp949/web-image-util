/**
 * web-image-util의 새로운 타입 시스템
 * Sharp 라이브러리의 API 패턴을 참고하여 설계됨
 */

/**
 * 이미지 소스 타입
 *
 * @description 지원하는 이미지 소스 형태:
 * - HTMLImageElement: DOM 이미지 엘리먼트
 * - Blob: File API Blob 객체
 * - string: SVG XML, Data URL, HTTP URL, 또는 상대/절대 경로
 */
export type ImageSource = HTMLImageElement | Blob | string;

/**
 * 리사이징 fit 옵션
 *
 * @description 이미지가 대상 치수에 맞는 방식:
 * - 'cover': 비율 유지하며 전체 영역을 채움, 필요시 잘림 (CSS object-fit: cover와 동일, 기본값)
 * - 'letterbox': 비율 유지하며 전체 이미지가 영역에 들어가도록 맞춤, 여백으로 채움 (확대/축소 모두)
 * - 'stretch': 비율 무시하고 정확히 맞춤 (이미지가 늘어나거나 압축됨)
 * - 'atMost': 비율 유지하며 최대 크기 제한, 전체 이미지가 영역에 들어가도록 맞춤 (축소만, 확대 안함)
 * - 'atLeast': 비율 유지하며 최소 크기 보장, 전체 영역을 채움 (확대만, 축소 안함)
 */
export type ResizeFit = 'cover' | 'letterbox' | 'stretch' | 'atMost' | 'atLeast';

/**
 * 리사이징 위치/중심점 옵션 (Sharp 호환)
 *
 * @description fit이 'cover' 또는 'letterbox'일 때 사용할 위치:
 * - 문자열: 'center', 'top', 'bottom', 'left', 'right' 등
 * - 조합: 'top left', 'bottom right' 등
 * - 숫자: 0-100 (백분율)
 * - 객체: { x: number, y: number } (백분율)
 */
export type ResizePosition =
  | 'center'
  | 'centre'
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top left'
  | 'top right'
  | 'bottom left'
  | 'bottom right'
  | 'left top'
  | 'right top'
  | 'left bottom'
  | 'right bottom'
  | number
  | { x: number; y: number };

/**
 * 배경색 타입 (Sharp 호환)
 *
 * @description fit이 'letterbox'일 때 사용할 배경색:
 * - 문자열: CSS 색상 ('red', '#ff0000', 'rgb(255,0,0)' 등)
 * - 객체: { r: number, g: number, b: number, alpha?: number }
 */
export type BackgroundColor =
  | string
  | {
      r: number;
      g: number;
      b: number;
      alpha?: number;
    };

/**
 * 리사이징 옵션
 */
export interface ResizeOptions {
  /** 대상 너비 (픽셀) */
  width?: number;
  /** 대상 높이 (픽셀) */
  height?: number;
  /** 이미지가 대상 치수에 맞는 방식 (기본: 'cover') */
  fit?: ResizeFit;
  /** 위치/중심점 (기본: 'center') */
  position?: ResizePosition;
  /** 배경색 (fit이 'letterbox'일 때, 기본: 투명한 검정) */
  background?: BackgroundColor;
  /** 확대 방지 여부 (기본: false) */
  withoutEnlargement?: boolean;
  /** 축소 방지 여부 (기본: false) */
  withoutReduction?: boolean;
}

/**
 * 블러 옵션
 */
export interface BlurOptions {
  /** 블러 반지름 (기본: 2) */
  radius?: number;
  /** 정밀도 (기본: 1) */
  precision?: number;
  /** 최소 진폭 (기본: 0.2) */
  minAmplitude?: number;
}

/**
 * 최대 크기 제한 옵션 (atMost 메서드들용)
 */
export interface AtMostOptions {
  /** 배경색 (투명 영역에 사용될 색상) */
  background?: BackgroundColor;
  /** 확대 방지 여부 (기본: true - 원본보다 크게 만들지 않음) */
  withoutEnlargement?: boolean;
  /** 품질 (0-1, 기본: 0.8) */
  quality?: number;
}

/**
 * 지원하는 이미지 포맷
 *
 * @description 웹 브라우저에서 Canvas API로 지원가능한 포맷들:
 * - jpeg/jpg: 손실 압축, 사진에 적합
 * - png: 무손실, 투명도 지원
 * - webp: 고효율 현대 포맷
 * - avif: 차세대 고효율 포맷 (브라우저 지원 필요)
 */
export type ImageFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'avif';

/**
 * 각 포맷별 최적 품질 설정
 *
 * @description 포맷 특성에 따른 권장 품질:
 * - PNG: 무손실 압축이므로 1.0 (품질 설정이 무의미)
 * - JPEG/JPG: 0.85 (품질과 파일크기의 균형점)
 * - WebP: 0.8 (JPEG보다 효율적, 대부분 브라우저 지원)
 * - AVIF: 0.7 (차세대 최고 효율 포맷, 낮은 수치로도 고품질)
 */
export const OPTIMAL_QUALITY_BY_FORMAT: Record<ImageFormat, number> = {
  png: 1.0,   // 무손실 압축
  jpeg: 0.85, // 품질과 크기의 균형
  jpg: 0.85,  // JPEG와 동일
  webp: 0.8,  // 고효율 압축, 대부분 브라우저 지원
  avif: 0.7,  // 차세대 최고 효율
} as const;

/**
 * 출력 옵션
 *
 * @description 인자 없이 호출 시 기본 동작:
 * - format: WebP 지원 브라우저에서는 'webp', 미지원 시 'png'
 * - quality: 포맷별 최적값 (webp: 0.8, jpeg: 0.85, png: 1.0, avif: 0.7)
 * - fallbackFormat: 'png'
 */
export interface OutputOptions {
  /** 출력 포맷 (기본: WebP 지원시 'webp', 미지원시 'png') */
  format?: ImageFormat;
  /** 압축 품질 0.0-1.0 (기본: 포맷별 최적값 - webp: 0.8, jpeg: 0.85, png: 1.0, avif: 0.7) */
  quality?: number;
  /** 포맷 미지원시 대체 포맷 (기본: 'png') */
  fallbackFormat?: ImageFormat;
}

/**
 * 프로세서 전역 옵션
 */
export interface ProcessorOptions {
  /** CORS 설정 (기본: 'anonymous') */
  crossOrigin?: string;
  /** 기본 품질 설정 (기본: 0.8, 포맷별 최적값이 우선) */
  defaultQuality?: number;
  /** 기본 배경색 (기본: 투명 검정 { r: 0, g: 0, b: 0, alpha: 0 }) */
  defaultBackground?: BackgroundColor;
}

/**
 * 에러 코드 (기존과 호환)
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
  | 'BLUR_FAILED'
  // 파일 관련 에러
  | 'OUTPUT_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'FILE_TOO_LARGE'
  // 브라우저 호환성 에러
  | 'BROWSER_NOT_SUPPORTED'
  | 'FEATURE_NOT_SUPPORTED';

/**
 * 이미지 처리 에러 클래스
 */
export class ImageProcessError extends Error {
  constructor(
    message: string,
    public code: ImageErrorCode,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ImageProcessError';

    // 스택 추적 설정
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ImageProcessError);
    }
  }
}

/**
 * 결과 메타데이터
 */
export interface ProcessResult {
  /** 결과 너비 */
  width: number;
  /** 결과 높이 */
  height: number;
  /** 처리 시간 (밀리초) */
  processingTime: number;
  /** 원본 크기 */
  originalSize?: {
    width: number;
    height: number;
  };
}

/**
 * Blob 결과 (메타데이터 포함)
 */
export interface BlobResult extends ProcessResult {
  blob: Blob;
}

/**
 * DataURL 결과 (메타데이터 포함)
 */
export interface DataURLResult extends ProcessResult {
  dataURL: string;
}

/**
 * 파일 결과 (메타데이터 포함)
 */
export interface FileResult extends ProcessResult {
  file: File;
}

// 타입 가드 함수들 export
export * from './guards';

// re-export 기존 호환성 유지
export type { ImageSource as OldImageSource } from '../base/common-types';
export { ImageErrorCode as OldImageErrorCode } from '../base/errors';
