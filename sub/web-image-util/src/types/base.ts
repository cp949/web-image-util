/**
 * 기본 타입 정의 - 순환 import 방지용
 *
 * @description 다른 타입 파일들에서 import할 수 있는 기본 타입들만 포함
 * guards.ts나 다른 타입 파일들이 이 파일을 import하여 순환 참조를 방지합니다.
 */

// ============================================================================
// CORE TYPES - 핵심 타입 정의
// ============================================================================

/**
 * 이미지 소스 타입
 *
 * @description 지원하는 이미지 소스 형태:
 * - HTMLImageElement: DOM 이미지 엘리먼트
 * - HTMLCanvasElement: Canvas 엘리먼트
 * - Blob: File API Blob 객체
 * - ArrayBuffer: 바이너리 데이터
 * - Uint8Array: 타입 배열
 * - string: SVG XML, Data URL, HTTP URL, 또는 상대/절대 경로
 */
export type ImageSource = HTMLImageElement | HTMLCanvasElement | Blob | ArrayBuffer | Uint8Array | string;

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
  AVIF: 'avif' as const,
} as const;

// ============================================================================
// RESIZE TYPES - 리사이징 관련 기본 타입들
// ============================================================================

/**
 * 리사이징 fit 옵션 (Canvas API 제한)
 *
 * @description 브라우저 Canvas에서 실제 구현 가능한 방식만:
 * - cover: 비율 유지하며 전체 영역을 채움, 필요시 잘림 (기본값)
 * - contain: 비율 유지하며 전체 이미지가 영역에 들어가도록 맞춤
 * - fill: 비율 무시하고 정확히 맞춤
 */
export type ResizeFit = 'cover' | 'contain' | 'fill';

/**
 * Fit 상수
 */
export const ResizeFitConstants = {
  COVER: 'cover' as const,
  CONTAIN: 'contain' as const,
  FILL: 'fill' as const,
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

// ============================================================================
// ERROR TYPES - 에러 관련 기본 타입들
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
  // 크기/차원 관련 에러
  | 'INVALID_DIMENSIONS'
  | 'DIMENSION_TOO_LARGE'
  // 시스템 자원 관련 에러
  | 'MEMORY_ERROR'
  | 'TIMEOUT_ERROR'
  // SVG 관련 에러
  | 'SVG_LOAD_FAILED'
  | 'SVG_PROCESSING_FAILED'
  // 출력 관련 에러
  | 'OUTPUT_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'FILE_TOO_LARGE'
  | 'CANVAS_TO_BLOB_FAILED'
  | 'IMAGE_LOAD_FAILED'
  | 'BLOB_TO_ARRAYBUFFER_FAILED'
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
  // 크기/차원 관련
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS' as const,
  DIMENSION_TOO_LARGE: 'DIMENSION_TOO_LARGE' as const,
  // 시스템 자원 관련
  MEMORY_ERROR: 'MEMORY_ERROR' as const,
  TIMEOUT_ERROR: 'TIMEOUT_ERROR' as const,
  // SVG 관련
  SVG_LOAD_FAILED: 'SVG_LOAD_FAILED' as const,
  SVG_PROCESSING_FAILED: 'SVG_PROCESSING_FAILED' as const,
  // 출력 관련
  OUTPUT_FAILED: 'OUTPUT_FAILED' as const,
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED' as const,
  FILE_TOO_LARGE: 'FILE_TOO_LARGE' as const,
  CANVAS_TO_BLOB_FAILED: 'CANVAS_TO_BLOB_FAILED' as const,
  IMAGE_LOAD_FAILED: 'IMAGE_LOAD_FAILED' as const,
  BLOB_TO_ARRAYBUFFER_FAILED: 'BLOB_TO_ARRAYBUFFER_FAILED' as const,
  // 브라우저 호환성
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED' as const,
  FEATURE_NOT_SUPPORTED: 'FEATURE_NOT_SUPPORTED' as const,
} as const;

// ============================================================================
// GEOMETRY TYPES - 기하학 관련 기본 타입들
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
export interface GeometryRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
