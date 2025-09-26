/**
 * web-image-util 통합 타입 시스템
 * 웹 브라우저용 이미지 처리 라이브러리의 타입 정의
 */

// ============================================================================
// CORE TYPES - 핵심 타입 정의
// ============================================================================

/**
 * 이미지 소스 타입
 *
 * @description 지원하는 이미지 소스 형태:
 * - HTMLImageElement: DOM 이미지 엘리먼트
 * - Blob: File API Blob 객체
 * - ArrayBuffer: 바이너리 데이터
 * - Uint8Array: 타입 배열
 * - string: SVG XML, Data URL, HTTP URL, 또는 상대/절대 경로
 */
export type ImageSource = HTMLImageElement | Blob | ArrayBuffer | Uint8Array | string;

/**
 * 지원하는 이미지 포맷 (브라우저 호환성 고려)
 *
 * @description 입력 지원 포맷:
 * - jpeg: JPEG 형식 (손실 압축, 사진에 적합)
 * - jpg: JPEG 별칭
 * - png: PNG 형식 (무손실, 투명도 지원)
 * - webp: WebP 형식 (고압축, 투명도 지원, 모던 브라우저)
 * - gif: GIF 형식 (입력만 지원, 애니메이션)
 * - svg: SVG 형식 (입력만 지원, 벡터 그래픽)
 */
export type ImageFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg';

/**
 * 출력 지원 포맷 (브라우저 호환성 우선)
 *
 * @description Canvas에서 안정적으로 출력 가능한 포맷:
 * - jpeg: JPEG 형식 (손실 압축)
 * - jpg: JPEG 별칭
 * - png: PNG 형식 (무손실, 투명도 지원)
 * - webp: WebP 형식 (고압축, 모던 브라우저)
 *
 * - avif: AVIF 형식 (최신 압축, 브라우저 지원 감지 필요)
 *
 * @note 제외된 포맷들:
 * - SVG: Canvas에서 SVG로 직접 렌더링 불가
 * - GIF: 애니메이션 처리 복잡성으로 제외
 */
export type OutputFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'avif';

/**
 * 포맷 상수 (const assertion으로 타입 안전성 강화)
 */
export const ImageFormats = {
  JPEG: 'jpeg' as const,
  JPG: 'jpg' as const,
  PNG: 'png' as const,
  WEBP: 'webp' as const,
  AVIF: 'avif' as const,
  GIF: 'gif' as const,
  SVG: 'svg' as const,
} as const;

/**
 * 출력 포맷 상수
 */
export const OutputFormats = {
  JPEG: 'jpeg' as const,
  JPG: 'jpg' as const,
  PNG: 'png' as const,
  WEBP: 'webp' as const,
} as const;

// ============================================================================
// RESIZE TYPES - 리사이징 관련 타입들 (ES2015 모듈 구문으로 변경)
// ============================================================================

/**
 * 리사이징 fit 옵션 (Canvas API 제한)
 *
 * @description 브라우저 Canvas에서 실제 구현 가능한 방식만:
 * - cover: 비율 유지하며 전체 영역을 채움, 필요시 잘림 (기본값)
 * - contain: 비율 유지하며 전체 이미지가 영역에 들어가도록 맞춤
 * - fill: 비율 무시하고 정확히 맞춤
 */
export type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/**
 * Fit 상수
 */
export const ResizeFitConstants = {
  COVER: 'cover' as const,
  CONTAIN: 'contain' as const,
  FILL: 'fill' as const,
  INSIDE: 'inside' as const,
  OUTSIDE: 'outside' as const,
} as const;

/**
 * 위치/중심점 옵션 (Canvas API 제한)
 *
 * @description Canvas drawImage()에서 실제 의미있는 기본적인 위치만:
 */
export type ResizePosition =
  | 'center'
  | 'centre' // 영국식 철자 호환
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | { x: number; y: number }; // 정확한 픽셀 위치

/**
 * 배경색 타입 (Canvas fillStyle 호환)
 *
 * @description Canvas fillStyle이 지원하는 CSS 색상 문자열만:
 * - CSS 색상명: 'red', 'blue', 'transparent'
 * - 16진수: '#ff0000', '#f00'
 * - RGB/RGBA: 'rgb(255,0,0)', 'rgba(255,0,0,0.5)'
 * - HSL/HSLA: 'hsl(0,100%,50%)'
 */
export type ResizeBackground = string | { r: number; g: number; b: number; alpha?: number };

/**
 * 리사이징 옵션
 */
export interface ResizeOptionsInterface {
  /** 대상 너비 (픽셀) */
  width?: number;
  /** 대상 높이 (픽셀) */
  height?: number;
  /** 이미지가 대상 치수에 맞는 방식 (기본: 'cover') */
  fit?: ResizeFit;
  /** 위치/중심점 (기본: 'center') */
  position?: ResizePosition;
  /** 배경색 (fit이 'contain'일 때, 기본: 투명한 검정) */
  background?: ResizeBackground;
  /** 확대 방지 여부 (기본: false, contain과 함께 사용하면 작은 이미지 확대 방지) */
  withoutEnlargement?: boolean;
  /** 축소 방지 여부 (기본: false) */
  withoutReduction?: boolean;
}

// Canvas API는 리사이징 전략 선택이나 메모리 직접 제어를 지원하지 않음
// 브라우저 내장 알고리즘만 사용 가능하므로 SmartResizeOptions는 ResizeOptions와 동일
export type SmartResizeOptions = ResizeOptions;

// ============================================================================
// BLUR NAMESPACE - 블러 관련 타입들
// ============================================================================

// ============================================================================
// BLUR TYPES - 블러 관련 타입들 (ES2015 모듈 구문으로 변경)
// ============================================================================

/**
 * 블러 옵션 (Canvas CSS filter 제한)
 */
export interface BlurOptionsInterface {
  /** 블러 반지름 (기본: 2) */
  radius?: number;
  // Canvas는 CSS filter blur()만 지원하므로 고급 옵션들 제거
}

// ============================================================================
// OUTPUT NAMESPACE - 출력 관련 타입들
// ============================================================================

// ============================================================================
// OUTPUT TYPES - 출력 관련 타입들 (ES2015 모듈 구문으로 변경)
// ============================================================================

/**
 * 각 포맷별 최적 품질 설정
 */
export const OutputOptimalQuality: Record<OutputFormat, number> = {
  png: 1.0, // 무손실 압축
  jpeg: 0.85, // 품질과 크기의 균형
  jpg: 0.85, // JPEG와 동일
  webp: 0.8, // 고효율 압축
  avif: 0.75, // 최고 압축률
} as const;

/**
 * 출력 옵션
 */
export interface OutputOptionsInterface {
  /** 출력 포맷 (기본: WebP 지원시 'webp', 미지원시 'png') */
  format?: OutputFormat;
  /** 압축 품질 0.0-1.0 (기본: 포맷별 최적값) */
  quality?: number;
  /** 포맷 미지원시 대체 포맷 (기본: 'png') */
  fallbackFormat?: OutputFormat;
}

/**
 * JPEG 특화 옵션
 */
export interface OutputJpegOptions {
  /** 품질 (1-100, 기본: 85) */
  quality?: number;
}

/**
 * WebP 특화 옵션
 */
export interface OutputWebpOptions {
  /** 품질 (0-100, 기본: 80) */
  quality?: number;
}

/**
 * AVIF 특화 옵션
 */
export interface OutputAvifOptions {
  /** 품질 (0-100, 기본: 70) */
  quality?: number;
}

// ============================================================================
// IMAGE ERROR TYPES - 이미지 에러 관련 타입들 (ES2015 모듈 구문으로 변경)
// ============================================================================

/**
 * 에러 코드 (통합 정의)
 */
export type ImageErrorCodeType =
  // 소스 관련 에러
  | 'INVALID_SOURCE'
  | 'UNSUPPORTED_FORMAT'
  | 'SOURCE_LOAD_FAILED'
  // 처리 관련 에러
  | 'CANVAS_CREATION_FAILED'
  | 'CANVAS_CONTEXT_FAILED'
  | 'RESIZE_FAILED'
  | 'CONVERSION_FAILED'
  | 'BLUR_FAILED'
  | 'PROCESSING_FAILED'
  | 'SMART_RESIZE_FAILED'
  // 출력 관련 에러
  | 'OUTPUT_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'FILE_TOO_LARGE'
  // 브라우저 호환성 에러
  | 'BROWSER_NOT_SUPPORTED'
  | 'FEATURE_NOT_SUPPORTED';

/**
 * 에러 코드 상수 (const assertion)
 */
export const ImageErrorCodeConstants = {
  // 소스 관련
  INVALID_SOURCE: 'INVALID_SOURCE' as const,
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT' as const,
  SOURCE_LOAD_FAILED: 'SOURCE_LOAD_FAILED' as const,
  // 처리 관련
  CANVAS_CREATION_FAILED: 'CANVAS_CREATION_FAILED' as const,
  CANVAS_CONTEXT_FAILED: 'CANVAS_CONTEXT_FAILED' as const,
  RESIZE_FAILED: 'RESIZE_FAILED' as const,
  CONVERSION_FAILED: 'CONVERSION_FAILED' as const,
  BLUR_FAILED: 'BLUR_FAILED' as const,
  PROCESSING_FAILED: 'PROCESSING_FAILED' as const,
  SMART_RESIZE_FAILED: 'SMART_RESIZE_FAILED' as const,
  // 출력 관련
  OUTPUT_FAILED: 'OUTPUT_FAILED' as const,
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED' as const,
  FILE_TOO_LARGE: 'FILE_TOO_LARGE' as const,
  // 브라우저 호환성
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED' as const,
  FEATURE_NOT_SUPPORTED: 'FEATURE_NOT_SUPPORTED' as const,
} as const;

/**
 * 이미지 처리 에러 클래스 (통합 정의)
 */
export class ImageProcessError extends globalThis.Error {
  public name: string = 'ImageProcessError';

  constructor(
    message: string,
    public code: ImageErrorCodeType,
    public originalError?: globalThis.Error
  ) {
    super(message);

    // 스택 추적 설정
    if ((globalThis.Error as any).captureStackTrace) {
      (globalThis.Error as any).captureStackTrace(this, ImageProcessError);
    }
  }
}

// ============================================================================
// GEOMETRY NAMESPACE - 기하학 관련 타입들
// ============================================================================

// ============================================================================
// GEOMETRY TYPES - 기하학 관련 타입들 (ES2015 모듈 구문으로 변경)
// ============================================================================

/**
 * 좌표 점
 */
export interface GeometryPoint {
  x: number;
  y: number;
}

/**
 * 크기
 */
export interface GeometrySize {
  width: number;
  height: number;
}

/**
 * 사각형
 */
export interface GeometryRectangle extends GeometryPoint, GeometrySize {}

// Canvas API에는 Sharp.js의 extend 기능과 같은 마진/패딩 개념이 없음
// 필요시 사용자가 Canvas 크기를 직접 조정해야 함

// ============================================================================
// RESULT NAMESPACE - 결과 관련 타입들
// ============================================================================

/**
 * 기본 처리 결과 메타데이터
 */
export interface ResultMetadata {
  /** 결과 너비 */
  width: number;
  /** 결과 높이 */
  height: number;
  /** 처리 시간 (밀리초) */
  processingTime: number;
  /** 원본 크기 */
  originalSize?: GeometrySize;
  /** 사용된 포맷 */
  format?: OutputFormat;
  // Canvas toBlob() 전에는 정확한 파일 크기를 알 수 없음
}

/**
 * Blob 결과 (메타데이터 포함)
 */
export interface ResultBlob extends ResultMetadata {
  blob: globalThis.Blob;
}

/**
 * DataURL 결과 (메타데이터 포함)
 */
export interface ResultDataURL extends ResultMetadata {
  dataURL: string;
}

/**
 * File 결과 (메타데이터 포함)
 */
export interface ResultFile extends ResultMetadata {
  file: globalThis.File;
}

/**
 * Canvas 결과 (메타데이터 포함)
 */
export interface ResultCanvas extends ResultMetadata {
  canvas: HTMLCanvasElement;
}

// ============================================================================
// PROCESSOR NAMESPACE - 프로세서 관련 타입들
// ============================================================================

/**
 * 프로세서 전역 옵션
 */
export interface ProcessorOptionsInterface {
  /** CORS 설정 (기본: 'anonymous') */
  crossOrigin?: string;
  /** 기본 품질 설정 (기본: 0.8) */
  defaultQuality?: number;
  /** 기본 배경색 (기본: 투명 검정) */
  defaultBackground?: ResizeBackground;
  /** 기본 포맷 (기본: 'auto') */
  defaultFormat?: OutputFormat | 'auto';
  /** 타임아웃 (밀리초, 기본: 30초) */
  timeout?: number;
  // 브라우저에서 메모리 제한을 명시적으로 설정할 수 없음
}

/**
 * 소스 변환 옵션
 */
export interface ProcessorSourceOptions {
  /** CORS 설정 */
  crossOrigin?: string;
  /** 엘리먼트 크기 */
  elementSize?: GeometrySize;
  // Canvas API는 DPI 제어나 애니메이션 처리를 지원하지 않음
}

// ============================================================================
// ESSENTIAL ALIASES - 기존 코드 동작을 위한 필수 별칭들
// ============================================================================

// 핵심 타입 별칭 (기존 코드 호환성)
export type ResizeOptions = ResizeOptionsInterface;
export type BlurOptions = BlurOptionsInterface;
export type OutputOptions = OutputOptionsInterface;
export type ProcessorOptions = ProcessorOptionsInterface;

// 결과 타입 별칭
export type ProcessResult = ResultMetadata;
export type BlobResult = ResultBlob;
export type DataURLResult = ResultDataURL;
export type FileResult = ResultFile;

// 개별 별칭들 (호환성 유지) - 이미 위에서 export되었으므로 제거

// 기하학적 타입 별칭 (이미 새로운 타입으로 정의됨)
// export type ResizeFit = ResizeFit; // 이미 정의됨
// export type ResizePosition = ResizePosition; // 이미 정의됨
export type BackgroundColor = ResizeBackground;

// 에러 타입 별칭 (호환성 유지)
export type ImageErrorCode = ImageErrorCodeType;
export const ImageErrorCode = ImageErrorCodeConstants;

// 상수 별칭
export const OPTIMAL_QUALITY_BY_FORMAT = OutputOptimalQuality;

// ============================================================================
// EXPORTS - 타입 가드 및 기타 유틸리티
// ============================================================================

// 타입 가드 함수들 export
export * from './guards';

// 주요 포맷 정보 제공
// Canvas API에서 직접 얻을 수 없는 포맷 메타데이터는 제거
// 필요시 브라우저의 Image 객체나 별도 라이브러리 사용
export const FORMAT_INFO = {
  // 기본적인 MIME 타입만 제공 (Canvas toBlob에서 사용)
  [ImageFormats.JPEG]: { mimeType: 'image/jpeg' },
  [ImageFormats.JPG]: { mimeType: 'image/jpeg' },
  [ImageFormats.PNG]: { mimeType: 'image/png' },
  [ImageFormats.WEBP]: { mimeType: 'image/webp' },
  [ImageFormats.GIF]: { mimeType: 'image/gif' },
  [ImageFormats.SVG]: { mimeType: 'image/svg+xml' },
} as const;

// 출력 포맷 정보
export const OUTPUT_FORMAT_INFO = {
  [OutputFormats.JPEG]: { mimeType: 'image/jpeg' },
  [OutputFormats.JPG]: { mimeType: 'image/jpeg' },
  [OutputFormats.PNG]: { mimeType: 'image/png' },
  [OutputFormats.WEBP]: { mimeType: 'image/webp' },
} as const;
