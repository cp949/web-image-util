/**
 * 브라우저 기능 감지 시스템
 *
 * @description Phase 3: OffscreenCanvas + Web Worker 성능 최적화를 위한
 * 브라우저 기능 감지 및 최적 처리 모드 선택 시스템
 */

// ============================================================================
// TYPES - 브라우저 기능 및 성능 관련 타입들
// ============================================================================

/**
 * 브라우저 기능 감지 결과
 */
export interface BrowserCapabilities {
  /** OffscreenCanvas 지원 여부 */
  offscreenCanvas: boolean;
  /** Web Workers 지원 여부 */
  webWorkers: boolean;
  /** ImageBitmap 지원 여부 */
  imageBitmap: boolean;
  /** WebP 포맷 지원 여부 */
  webp: boolean;
  /** AVIF 포맷 지원 여부 */
  avif: boolean;
  /** Transferable Objects 지원 여부 */
  transferableObjects: boolean;
  /** SharedArrayBuffer 지원 여부 */
  sharedArrayBuffer: boolean;
  /** 장치 픽셀 비율 */
  devicePixelRatio: number;
}

/**
 * 성능 기능 분석 결과
 */
export interface PerformanceFeatures {
  /** OffscreenCanvas 사용 가능 여부 */
  canUseOffscreenCanvas: boolean;
  /** Web Workers 사용 가능 여부 */
  canUseWebWorkers: boolean;
  /** ImageBitmap 사용 가능 여부 */
  canUseImageBitmap: boolean;
  /** 권장 처리 모드 */
  recommendedProcessingMode: 'main-thread' | 'web-worker' | 'offscreen';
}

/**
 * 감지 옵션
 */
export interface DetectionOptions {
  /** 캐시 사용 여부 (기본: true) */
  useCache?: boolean;
  /** 타임아웃 시간 (밀리초, 기본: 5000) */
  timeout?: number;
  /** 디버그 모드 (기본: false) */
  debug?: boolean;
}

// ============================================================================
// CACHE SYSTEM - 감지 결과 캐싱 시스템
// ============================================================================

/**
 * 감지 결과 캐시
 */
class CapabilityCache {
  private cache = new Map<string, any>();
  private isSSR = typeof window === 'undefined' && typeof globalThis.document === 'undefined';

  /**
   * 캐시에서 값 가져오기
   */
  get<T>(key: string): T | undefined {
    if (this.isSSR) return undefined;
    return this.cache.get(key);
  }

  /**
   * 캐시에 값 저장하기
   */
  set<T>(key: string, value: T): void {
    if (this.isSSR) return;
    this.cache.set(key, value);
  }

  /**
   * 캐시 초기화
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * SSR 환경 여부
   */
  get isServerSide(): boolean {
    return this.isSSR;
  }
}

const capabilityCache = new CapabilityCache();

// ============================================================================
// FEATURE DETECTION FUNCTIONS - 개별 기능 감지 함수들
// ============================================================================

/**
 * OffscreenCanvas 지원 여부 감지
 */
function detectOffscreenCanvas(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    return typeof OffscreenCanvas !== 'undefined' &&
           typeof OffscreenCanvas.prototype.getContext === 'function';
  } catch {
    return false;
  }
}

/**
 * Web Workers 지원 여부 감지
 */
function detectWebWorkers(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    return typeof Worker !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * ImageBitmap 지원 여부 감지
 */
function detectImageBitmap(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    return typeof ImageBitmap !== 'undefined' &&
           typeof createImageBitmap === 'function';
  } catch {
    return false;
  }
}

/**
 * Transferable Objects 지원 여부 감지
 */
function detectTransferableObjects(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    // MessageChannel을 사용한 테스트
    const channel = new MessageChannel();
    const buffer = new ArrayBuffer(8);

    // 동기적으로 transferable 여부만 확인
    return typeof channel.port1.postMessage === 'function' &&
           buffer instanceof ArrayBuffer;
  } catch {
    return false;
  }
}

/**
 * SharedArrayBuffer 지원 여부 감지
 */
function detectSharedArrayBuffer(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    return typeof SharedArrayBuffer !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * 장치 픽셀 비율 가져오기
 */
function getDevicePixelRatio(): number {
  if (capabilityCache.isServerSide) return 1;

  try {
    return globalThis.devicePixelRatio || 1;
  } catch {
    return 1;
  }
}

// ============================================================================
// ASYNC FORMAT DETECTION - 비동기 포맷 지원 감지
// ============================================================================

/**
 * WebP 지원 여부 비동기 감지
 */
async function detectWebPSupport(timeout: number = 5000): Promise<boolean> {
  if (capabilityCache.isServerSide) return false;

  const cached = capabilityCache.get<boolean>('webp');
  if (cached !== undefined) return cached;

  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => resolve(false), timeout);

    try {
      const img = new Image();

      img.onload = () => {
        clearTimeout(timeoutId);
        const supported = img.width === 1 && img.height === 1;
        capabilityCache.set('webp', supported);
        resolve(supported);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        capabilityCache.set('webp', false);
        resolve(false);
      };

      // 1x1 WebP 이미지 (투명)
      img.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
    } catch {
      clearTimeout(timeoutId);
      capabilityCache.set('webp', false);
      resolve(false);
    }
  });
}

/**
 * AVIF 지원 여부 비동기 감지
 */
async function detectAVIFSupport(timeout: number = 5000): Promise<boolean> {
  if (capabilityCache.isServerSide) return false;

  const cached = capabilityCache.get<boolean>('avif');
  if (cached !== undefined) return cached;

  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => resolve(false), timeout);

    try {
      const img = new Image();

      img.onload = () => {
        clearTimeout(timeoutId);
        const supported = img.width === 1 && img.height === 1;
        capabilityCache.set('avif', supported);
        resolve(supported);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        capabilityCache.set('avif', false);
        resolve(false);
      };

      // 1x1 AVIF 이미지 (투명)
      img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    } catch {
      clearTimeout(timeoutId);
      capabilityCache.set('avif', false);
      resolve(false);
    }
  });
}

// ============================================================================
// PROCESSING MODE SELECTION - 최적 처리 모드 선택 알고리즘
// ============================================================================

/**
 * 브라우저 기능을 바탕으로 최적 처리 모드 결정
 */
function determineOptimalProcessingMode(capabilities: BrowserCapabilities): 'main-thread' | 'web-worker' | 'offscreen' {
  // 우선순위: offscreen > web-worker > main-thread

  // 1. OffscreenCanvas + Web Workers + ImageBitmap = 최고 성능
  if (capabilities.offscreenCanvas &&
      capabilities.webWorkers &&
      capabilities.imageBitmap &&
      capabilities.transferableObjects) {
    return 'offscreen';
  }

  // 2. Web Workers + Transferable Objects = 중간 성능
  if (capabilities.webWorkers &&
      capabilities.transferableObjects) {
    return 'web-worker';
  }

  // 3. 메인 스레드 처리 (기본)
  return 'main-thread';
}

/**
 * 성능 기능 분석 (내부 함수)
 */
function analyzePerformanceFeaturesInternal(capabilities: BrowserCapabilities): PerformanceFeatures {
  return {
    canUseOffscreenCanvas: capabilities.offscreenCanvas && capabilities.webWorkers,
    canUseWebWorkers: capabilities.webWorkers && capabilities.transferableObjects,
    canUseImageBitmap: capabilities.imageBitmap,
    recommendedProcessingMode: determineOptimalProcessingMode(capabilities),
  };
}

// ============================================================================
// MAIN DETECTOR CLASS - 메인 브라우저 기능 감지 클래스
// ============================================================================

/**
 * 브라우저 기능 감지기
 */
export class BrowserCapabilityDetector {
  private static instance: BrowserCapabilityDetector;

  /**
   * 싱글톤 인스턴스 가져오기
   */
  static getInstance(): BrowserCapabilityDetector {
    if (!BrowserCapabilityDetector.instance) {
      BrowserCapabilityDetector.instance = new BrowserCapabilityDetector();
    }
    return BrowserCapabilityDetector.instance;
  }

  /**
   * 전체 브라우저 기능 감지 (비동기)
   */
  async detectCapabilities(options: DetectionOptions = {}): Promise<BrowserCapabilities> {
    const { useCache = true, timeout = 5000, debug = false } = options;

    const cacheKey = 'browser-capabilities';

    // 캐시된 결과 확인
    if (useCache) {
      const cached = capabilityCache.get<BrowserCapabilities>(cacheKey);
      if (cached) {
        if (debug) console.log('[BrowserCapabilities] 캐시된 결과 사용:', cached);
        return cached;
      }
    }

    if (debug) console.log('[BrowserCapabilities] 새로운 감지 시작...');

    // 동기 기능들 먼저 감지
    const syncCapabilities = {
      offscreenCanvas: detectOffscreenCanvas(),
      webWorkers: detectWebWorkers(),
      imageBitmap: detectImageBitmap(),
      transferableObjects: detectTransferableObjects(),
      sharedArrayBuffer: detectSharedArrayBuffer(),
      devicePixelRatio: getDevicePixelRatio(),
    };

    if (debug) console.log('[BrowserCapabilities] 동기 기능 감지 완료:', syncCapabilities);

    // 비동기 포맷 지원 감지
    const [webp, avif] = await Promise.all([
      detectWebPSupport(timeout),
      detectAVIFSupport(timeout),
    ]);

    const capabilities: BrowserCapabilities = {
      ...syncCapabilities,
      webp,
      avif,
    };

    if (debug) console.log('[BrowserCapabilities] 전체 감지 완료:', capabilities);

    // 캐시에 저장
    if (useCache) {
      capabilityCache.set(cacheKey, capabilities);
    }

    return capabilities;
  }

  /**
   * 성능 기능 분석
   */
  async analyzePerformance(options: DetectionOptions = {}): Promise<PerformanceFeatures> {
    const capabilities = await this.detectCapabilities(options);
    return analyzePerformanceFeaturesInternal(capabilities);
  }

  /**
   * 개별 기능 감지 (동기)
   */
  detectSyncFeatures(): Omit<BrowserCapabilities, 'webp' | 'avif'> {
    return {
      offscreenCanvas: detectOffscreenCanvas(),
      webWorkers: detectWebWorkers(),
      imageBitmap: detectImageBitmap(),
      transferableObjects: detectTransferableObjects(),
      sharedArrayBuffer: detectSharedArrayBuffer(),
      devicePixelRatio: getDevicePixelRatio(),
    };
  }

  /**
   * 포맷 지원 감지 (비동기)
   */
  async detectFormatSupport(timeout: number = 5000): Promise<{ webp: boolean; avif: boolean }> {
    const [webp, avif] = await Promise.all([
      detectWebPSupport(timeout),
      detectAVIFSupport(timeout),
    ]);

    return { webp, avif };
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    capabilityCache.clear();
  }

  /**
   * SSR 환경 여부
   */
  get isServerSide(): boolean {
    return capabilityCache.isServerSide;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS - 편의 함수들
// ============================================================================

/**
 * 빠른 브라우저 기능 감지 (싱글톤 사용)
 */
export async function detectBrowserCapabilities(options?: DetectionOptions): Promise<BrowserCapabilities> {
  const detector = BrowserCapabilityDetector.getInstance();
  return detector.detectCapabilities(options);
}

/**
 * 빠른 성능 기능 분석 (싱글톤 사용)
 */
export async function analyzePerformanceFeatures(options?: DetectionOptions): Promise<PerformanceFeatures> {
  const detector = BrowserCapabilityDetector.getInstance();
  return detector.analyzePerformance(options);
}

/**
 * 동기 기능만 빠르게 감지
 */
export function detectSyncCapabilities(): Omit<BrowserCapabilities, 'webp' | 'avif'> {
  const detector = BrowserCapabilityDetector.getInstance();
  return detector.detectSyncFeatures();
}

/**
 * 포맷 지원만 빠르게 감지
 */
export async function detectFormatSupport(timeout?: number): Promise<{ webp: boolean; avif: boolean }> {
  const detector = BrowserCapabilityDetector.getInstance();
  return detector.detectFormatSupport(timeout);
}

/**
 * 최적 처리 모드 빠른 결정
 */
export async function getOptimalProcessingMode(options?: DetectionOptions): Promise<'main-thread' | 'web-worker' | 'offscreen'> {
  const performance = await analyzePerformanceFeatures(options);
  return performance.recommendedProcessingMode;
}

// ============================================================================
// CONSTANTS - 상수 정의
// ============================================================================

/**
 * 기본 감지 옵션
 */
export const DEFAULT_DETECTION_OPTIONS: Required<DetectionOptions> = {
  useCache: true,
  timeout: 5000,
  debug: false,
} as const;

/**
 * 처리 모드별 설명
 */
export const PROCESSING_MODE_DESCRIPTIONS = {
  'offscreen': 'OffscreenCanvas + Web Worker를 사용한 최고 성능 처리',
  'web-worker': 'Web Worker를 사용한 멀티스레드 처리',
  'main-thread': '메인 스레드에서 처리 (기본, 호환성 최우선)',
} as const;

/**
 * 기능별 성능 임팩트 가중치
 */
export const FEATURE_PERFORMANCE_WEIGHTS = {
  offscreenCanvas: 0.4,    // 40% - 가장 큰 성능 향상
  webWorkers: 0.3,         // 30% - 멀티스레드 처리
  imageBitmap: 0.15,       // 15% - 효율적인 이미지 처리
  transferableObjects: 0.1, // 10% - 데이터 전송 최적화
  webp: 0.03,              // 3% - 작은 파일 크기
  avif: 0.02,              // 2% - 더 작은 파일 크기
} as const;