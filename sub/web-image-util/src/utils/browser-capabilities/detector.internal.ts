/**
 * 동기/비동기 감지 함수와 성능 분석을 묶어 외부에 제공하는 파사드 계층이다.
 *
 * @description 감지 로직은 모듈 함수가 소유하고, `BrowserCapabilityDetector`는 같은 동작을
 * 객체 형태로 쓰는 호출자를 위해 그 함수들에 위임한다. 인스턴스에 상태가 없고 캐시는 모듈 레벨
 * `capabilityCache`가 보관하므로 두 표면의 결과는 항상 같다. 캐시 키 `browser-capabilities`로
 * 종합 결과를 보관해 반복 호출 비용을 제거한다.
 */

import { capabilityCache } from './cache.internal';
import {
  detectImageBitmap,
  detectOffscreenCanvas,
  detectSharedArrayBuffer,
  detectTransferableObjects,
  detectWebWorkers,
  getDevicePixelRatio,
} from './feature-detection.internal';
import { detectAVIFSupport, detectFormatSupport, detectWebPSupport } from './format-detection.internal';
import { analyzePerformanceFeaturesInternal } from './performance.internal';
import type { BrowserCapabilities, DetectionOptions, PerformanceFeatures } from './types';

const CAPABILITIES_CACHE_KEY = 'browser-capabilities';

/**
 * 브라우저 기능을 모두 감지한다 (비동기)
 *
 * @description 같은 모듈의 `detectSyncCapabilities()`를 직접 호출하므로 export에 대한
 * spy로 내부 호출을 바꿀 수 없다. 테스트는 공개 결과 또는 하위 feature 감지 모듈을 경계로 삼는다.
 */
export async function detectBrowserCapabilities(options: DetectionOptions = {}): Promise<BrowserCapabilities> {
  const { useCache = true, timeout = 5000, debug = false } = options;

  // 캐시된 결과를 먼저 확인한다.
  if (useCache) {
    const cached = capabilityCache.get<BrowserCapabilities>(CAPABILITIES_CACHE_KEY);
    if (cached) {
      if (debug) console.log('[BrowserCapabilities] Using cached results:', cached);
      return cached;
    }
  }

  if (debug) console.log('[BrowserCapabilities] Starting new detection...');

  // 동기 기능을 먼저 감지한다.
  const syncCapabilities = detectSyncCapabilities();

  if (debug) console.log('[BrowserCapabilities] Synchronous capabilities detected:', syncCapabilities);

  // 비동기 포맷 지원 여부를 감지한다.
  const [webp, avif] = await Promise.all([detectWebPSupport(timeout), detectAVIFSupport(timeout)]);

  const capabilities: BrowserCapabilities = {
    ...syncCapabilities,
    webp,
    avif,
  };

  if (debug) console.log('[BrowserCapabilities] All capabilities detected:', capabilities);

  // 이후 호출을 위해 결과를 캐시에 저장한다.
  if (useCache) {
    capabilityCache.set(CAPABILITIES_CACHE_KEY, capabilities);
  }

  return capabilities;
}

/**
 * 감지 결과를 성능 특성으로 분석한다
 */
export async function analyzePerformanceFeatures(options: DetectionOptions = {}): Promise<PerformanceFeatures> {
  const capabilities = await detectBrowserCapabilities(options);
  return analyzePerformanceFeaturesInternal(capabilities);
}

/**
 * 동기로 판별 가능한 기능만 감지한다
 */
export function detectSyncCapabilities(): Omit<BrowserCapabilities, 'webp' | 'avif'> {
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
 * 현재 캐시에 저장된 브라우저 기능 감지 결과를 반환한다.
 *
 * 비동기 감지를 아직 수행하지 않았다면 undefined를 반환한다.
 */
export function getCachedBrowserCapabilities(): BrowserCapabilities | undefined {
  return capabilityCache.get<BrowserCapabilities>(CAPABILITIES_CACHE_KEY);
}

/**
 * 권장 처리 모드를 판정한다
 */
export async function getOptimalProcessingMode(
  options?: DetectionOptions
): Promise<'main-thread' | 'web-worker' | 'offscreen'> {
  const performance = await analyzePerformanceFeatures(options);
  return performance.recommendedProcessingMode;
}

/**
 * Browser capability detector
 *
 * @description 위 모듈 함수들과 같은 동작을 객체 형태로 제공한다. 인스턴스 필드가 없고
 * 캐시는 모듈 레벨에 있으므로, 어느 쪽으로 호출하든 결과와 캐시 상태를 공유한다.
 */
export class BrowserCapabilityDetector {
  private static instance: BrowserCapabilityDetector;

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserCapabilityDetector {
    if (!BrowserCapabilityDetector.instance) {
      BrowserCapabilityDetector.instance = new BrowserCapabilityDetector();
    }
    return BrowserCapabilityDetector.instance;
  }

  /**
   * Detect all browser capabilities (asynchronous)
   */
  async detectCapabilities(options: DetectionOptions = {}): Promise<BrowserCapabilities> {
    return detectBrowserCapabilities(options);
  }

  /**
   * Analyze performance features
   */
  async analyzePerformance(options: DetectionOptions = {}): Promise<PerformanceFeatures> {
    return analyzePerformanceFeatures(options);
  }

  /**
   * Detect individual features (synchronous)
   */
  detectSyncFeatures(): Omit<BrowserCapabilities, 'webp' | 'avif'> {
    return detectSyncCapabilities();
  }

  /**
   * Detect format support (asynchronous)
   */
  async detectFormatSupport(timeout: number = 5000): Promise<{ webp: boolean; avif: boolean }> {
    return detectFormatSupport(timeout);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    capabilityCache.clear();
  }

  /**
   * Whether SSR environment
   */
  get isServerSide(): boolean {
    return capabilityCache.isServerSide;
  }
}

/**
 * Default detection options
 */
export const DEFAULT_DETECTION_OPTIONS: Required<DetectionOptions> = {
  useCache: true,
  timeout: 5000,
  debug: false,
} as const;
