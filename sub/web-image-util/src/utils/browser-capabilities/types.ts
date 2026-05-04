/**
 * 브라우저 기능 감지와 성능 분석에 쓰는 공개 타입 정의 모음이다.
 */

/** 브라우저 기능 감지 결과다. */
export interface BrowserCapabilities {
  /** OffscreenCanvas support */
  offscreenCanvas: boolean;
  /** Web Workers support */
  webWorkers: boolean;
  /** ImageBitmap support */
  imageBitmap: boolean;
  /** WebP format support */
  webp: boolean;
  /** AVIF format support */
  avif: boolean;
  /** Transferable Objects support */
  transferableObjects: boolean;
  /** SharedArrayBuffer support */
  sharedArrayBuffer: boolean;
  /** Device pixel ratio */
  devicePixelRatio: number;
}

/** 성능 관련 기능 분석 결과다. */
export interface PerformanceFeatures {
  /** Whether OffscreenCanvas can be used */
  canUseOffscreenCanvas: boolean;
  /** Whether Web Workers can be used */
  canUseWebWorkers: boolean;
  /** Whether ImageBitmap can be used */
  canUseImageBitmap: boolean;
  /** Recommended processing mode */
  recommendedProcessingMode: 'main-thread' | 'web-worker' | 'offscreen';
}

/** 기능 감지 옵션이다. */
export interface DetectionOptions {
  /** Whether to use cache (default: true) */
  useCache?: boolean;
  /** Timeout duration in milliseconds (default: 5000) */
  timeout?: number;
  /** Debug mode (default: false) */
  debug?: boolean;
}
