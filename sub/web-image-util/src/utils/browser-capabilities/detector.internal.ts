/**
 * 브라우저 기능 감지와 성능 분석을 제공하는 모듈 함수 모음이다.
 *
 * @description 감지 로직을 이 모듈이 단독 소유한다. 캐시는 `cache.internal.ts`가 정의하는
 * 모듈 레벨 `capabilityCache`를 이 모듈과 `format-detection.internal.ts`가 함께 쓴다 — 이
 * 모듈은 캐시 키 `browser-capabilities`로 종합 결과를 보관해 반복 호출 비용을 제거한다.
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
import { detectAVIFSupport, detectWebPSupport } from './format-detection.internal';
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
 * Default detection options
 */
export const DEFAULT_DETECTION_OPTIONS: Required<DetectionOptions> = {
  useCache: true,
  timeout: 5000,
  debug: false,
} as const;
