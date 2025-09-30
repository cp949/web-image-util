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
  ImageFormat,
  OutputFormat,
  GeometrySize,
  ResizeBackground,
  ResizeFit,
  ResizePosition,
  ImageErrorCodeType,
} from './base';

// ResizeConfig 타입을 ImageProcessor에서 사용하기 위해 import
import type { ResizeConfig } from './resize-config';

import { ImageFormats, OutputFormats, ImageErrorCodeConstants } from './base';

// ============================================================================
// RESIZE TYPES - 리사이징 관련 타입들
// ============================================================================

// v2.0 새로운 ResizeConfig 타입 시스템 (Discriminated Union)
export type {
  ResizeConfig,
  CoverConfig,
  ContainConfig,
  FillConfig,
  MaxFitConfig,
  MinFitConfig,
  Padding,
  BaseResizeConfig,
} from './resize-config';

export {
  isCoverConfig,
  isContainConfig,
  isFillConfig,
  isMaxFitConfig,
  isMinFitConfig,
  validateResizeConfig,
} from './resize-config';


/**
 * 스마트 리사이징 옵션 (고급 처리용)
 * v2.0+에서 ResizeConfig와 함께 사용
 */
export interface SmartResizeOptions {
  /** 대상 너비 (픽셀) */
  width?: number;
  /** 대상 높이 (픽셀) */
  height?: number;

  /**
   * 처리 전략 - 대부분의 경우 'auto'면 충분
   * @default 'auto'
   */
  strategy?: 'auto' | 'fast' | 'quality' | 'memory-efficient';

  /**
   * 성능 프로파일 - 간단한 3가지 선택지
   * @default 'balanced'
   */
  performance?: 'fast' | 'balanced' | 'quality';

  /**
   * 진행률 콜백 - 0-100 단순 진행률만 제공
   * @param progress 0-100 진행률
   */
  onProgress?: (progress: number) => void;

  /**
   * 메모리 제한 (MB) - 기본값: 자동 감지
   */
  maxMemoryMB?: number;
}

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

// =================================
// OUTPUT TYPES - 출력 관련 타입들
// =================================

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
}

/**
 * Blob 결과 (메타데이터 포함)
 */
export interface ResultBlob extends ResultMetadata {
  blob: globalThis.Blob;

  // 🆕 추가 메타데이터 (테스트 호환성)
  /** 배경색 정보 (옵션) */
  background?: string;
  /** 사용된 품질 설정 (옵션) */
  quality?: number;

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

  // 직접 변환 메서드들
  toBlob(options?: OutputOptions): Promise<globalThis.Blob>;
  toDataURL(options?: OutputOptions): Promise<string>;
  toFile(filename: string, options?: OutputOptions): Promise<globalThis.File>;
  toElement(): Promise<HTMLImageElement>;
  toArrayBuffer(): Promise<ArrayBuffer>;
  toUint8Array(): Promise<Uint8Array>;
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
  /** devicePixelRatio 사용 여부 (기본: false) */
  useDevicePixelRatio?: boolean;
  // 브라우저에서 메모리 제한을 명시적으로 설정할 수 없음
}

/**
 * 이미지 프로세서 인터페이스
 */
export interface ImageProcessor {
  resize(config: ResizeConfig): ImageProcessor;
  blur(radius?: number, options?: Partial<BlurOptions>): ImageProcessor;
  toBlob(options?: OutputOptions): Promise<ResultBlob>;
  toDataURL(options?: OutputOptions): Promise<ResultDataURL>;
  toFile(filename: string, options?: OutputOptions): Promise<ResultFile>;
  toCanvas(): Promise<ResultCanvas>;
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
  [ImageFormats.AVIF]: { mimeType: 'image/avif' },
  [ImageFormats.GIF]: { mimeType: 'image/gif' },
  [ImageFormats.SVG]: { mimeType: 'image/svg+xml' },
} as const;

// 출력 포맷 정보
export const OUTPUT_FORMAT_INFO = {
  [OutputFormats.JPEG]: { mimeType: 'image/jpeg' },
  [OutputFormats.JPG]: { mimeType: 'image/jpeg' },
  [OutputFormats.PNG]: { mimeType: 'image/png' },
  [OutputFormats.WEBP]: { mimeType: 'image/webp' },
  [OutputFormats.AVIF]: { mimeType: 'image/avif' },
} as const;

// ============================================================================
// PRESET TYPES - 프리셋 관련 타입들 re-export
// ============================================================================

export type { ThumbnailOptions, AvatarOptions, SocialImageOptions, SocialPlatform } from '../presets';

// ============================================================================
// ADDITIONAL TYPES - 테스트 호환성을 위한 추가 타입들
// ============================================================================

/**
 * MIME 타입
 */
export type MimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/svg+xml' | 'image/avif';

/**
 * 스마트 포맷 옵션
 */
export interface SmartFormatOptions {
  enableWebP?: boolean;
  enableAVIF?: boolean;
  fallbackFormat?: OutputFormat;
  autoDetect?: boolean;
}

/**
 * 성능 설정
 */
export interface PerformanceConfig {
  maxMemoryMB?: number;
  enableMultiThreading?: boolean;
  chunkSize?: number;
  optimizeForSpeed?: boolean;
}

// ============================================================================
// SVG QUALITY ENHANCEMENT TYPES - SVG 품질 향상 관련 타입들
// ============================================================================

// SVG 크기 정보 및 Canvas 고품질 설정 타입 re-export
export type { SvgDimensions } from '../utils/svg-dimensions';
export type { HighQualityCanvasOptions } from '../base/canvas-utils';

// SVG 복잡도 분석 및 품질 시스템 타입들
export type { SvgComplexityMetrics, ComplexityAnalysisResult, QualityLevel } from '../core/svg-complexity-analyzer';

// (제거됨: SvgProcessingOptions, SvgProcessingResult - v2.0에서 불필요)

// 브라우저 기능 감지 시스템 타입들
export type { BrowserCapabilities, PerformanceFeatures, DetectionOptions } from '../utils/browser-capabilities';

// OffscreenCanvas + Web Worker 고성능 처리 타입들
// (OffscreenSVGProcessor에서 사용하는 타입들은 해당 모듈에서 정의되어 있음)

// ============================================================================
// ADVANCED PROCESSING TYPES - 고급 처리 관련 통합 타입들
// ============================================================================

/**
 * 고급 SVG 처리 모드
 */
export type AdvancedProcessingMode = 'standard' | 'offscreen' | 'auto';

/**
 * 성능 벤치마크 결과
 */
export interface PerformanceBenchmark {
  /** 표준 처리 시간 (밀리초) */
  standardTime: number;
  /** OffscreenCanvas 처리 시간 (밀리초, 지원 시에만) */
  offscreenTime?: number;
  /** OffscreenCanvas가 더 빠른지 여부 */
  isOffscreenFaster: boolean;
  /** 권장 처리 방식 */
  recommendation: 'standard' | 'offscreen';
}

// SystemPerformanceProfile은 advanced/index.ts에서 직접 정의
// 여기서는 re-export만 수행하여 타입 의존성 문제 해결
