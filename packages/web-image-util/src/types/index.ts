/**
 * web-image-util 통합 타입 시스템
 * 웹 브라우저용 이미지 처리 라이브러리의 타입 정의
 */

// ============================================================================
// BASE TYPES - 기본 타입들 (base.ts에서 re-export)
// ============================================================================

export type {
  ImageSource,
  ImageFormat,
  OutputFormat,
  ResizeFit,
  ResizePosition,
  ResizeBackground,
  ImageErrorCodeType,
  GeometryPoint,
  GeometrySize,
  GeometryRectangle,
} from './base';

export { ImageFormats, OutputFormats, ResizeFitConstants, ImageErrorCodeConstants } from './base';

// base.ts에서 가져온 타입들을 다시 사용 가능하도록 import
import type {
  OutputFormat,
  GeometrySize,
  ResizeBackground,
  ResizeFit,
  ResizePosition,
  ImageErrorCodeType,
} from './base';

import { ImageFormats, OutputFormats, ImageErrorCodeConstants } from './base';

// ============================================================================
// RESIZE TYPES - 리사이징 관련 타입들
// ============================================================================

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
  /** 배경색 (fit이 'contain'일 때, 기본: 투명한 검정) */
  background?: ResizeBackground;
  /** 확대 방지 여부 (기본: false, contain과 함께 사용하면 작은 이미지 확대 방지) */
  withoutEnlargement?: boolean;
  /** 축소 방지 여부 (기본: false) */
  withoutReduction?: boolean;
}

// Canvas API는 리사이징 전략 선택이나 메모리 직접 제어를 지원하지 않음
// SmartResizeOptions는 core/smart-processor.ts에서 정의됨 (확장된 옵션 포함)
export type { SmartResizeOptions } from '../core/smart-processor';

// ============================================================================
// BLUR NAMESPACE - 블러 관련 타입들
// ============================================================================

// ============================================================================
// BLUR TYPES - 블러 관련 타입들 (ES2015 모듈 구문으로 변경)
// ============================================================================

/**
 * 블러 옵션 (Canvas CSS filter 제한)
 */
export interface BlurOptions {
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
export interface OutputOptions {
  /** 출력 포맷 (기본: WebP 지원시 'webp', 미지원시 'png') */
  format?: OutputFormat;
  /** 압축 품질 0.0-1.0 (기본: 포맷별 최적값) */
  quality?: number;
  /** 포맷 미지원시 대체 포맷 (기본: 'png') */
  fallbackFormat?: OutputFormat;
}

// ============================================================================
// IMAGE ERROR TYPES - 이미지 에러 관련 타입들
// ============================================================================

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

  // 🆕 직접 변환 메서드들 (성능 최적화)
  toCanvas(): Promise<HTMLCanvasElement>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * DataURL 결과 (메타데이터 포함)
 */
export interface ResultDataURL extends ResultMetadata {
  dataURL: string;

  // 🆕 직접 변환 메서드들 (크기 정보 재사용으로 성능 최적화)
  toCanvas(): Promise<HTMLCanvasElement>;
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
}

/**
 * File 결과 (메타데이터 포함)
 */
export interface ResultFile extends ResultMetadata {
  file: globalThis.File;

  // 🆕 직접 변환 메서드들
  toCanvas(): Promise<HTMLCanvasElement>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
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
export interface ProcessorOptions {
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
// CONSTANTS - 상수 정의
// ============================================================================

/**
 * 포맷별 최적 품질 설정
 */
export const OPTIMAL_QUALITY_BY_FORMAT = OutputOptimalQuality;

/**
 * 에러 코드 상수 (테스트 호환성)
 */
export const ImageErrorCode = ImageErrorCodeConstants;

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
