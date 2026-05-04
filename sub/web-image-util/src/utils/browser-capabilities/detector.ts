/**
 * 동기/비동기 감지 함수와 성능 분석을 묶어 외부에 제공하는 파사드 계층이다.
 *
 * @description `BrowserCapabilityDetector`는 싱글톤 진입점이고, 동명의 편의 함수들은
 * 같은 인스턴스를 통해 빠른 호출 표면을 제공한다. 캐시 키 `browser-capabilities`로
 * 종합 결과를 보관해 반복 호출 비용을 제거한다.
 */

import { capabilityCache } from './cache';
import {
  detectImageBitmap,
  detectOffscreenCanvas,
  detectSharedArrayBuffer,
  detectTransferableObjects,
  detectWebWorkers,
  getDevicePixelRatio,
} from './feature-detection';
import { detectAVIFSupport, detectFormatSupport, detectWebPSupport } from './format-detection';
import { analyzePerformanceFeaturesInternal } from './performance';
import type { BrowserCapabilities, DetectionOptions, PerformanceFeatures } from './types';

const CAPABILITIES_CACHE_KEY = 'browser-capabilities';

/**
 * Browser capability detector
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
    const { useCache = true, timeout = 5000, debug = false } = options;

    // Check cached results
    if (useCache) {
      const cached = capabilityCache.get<BrowserCapabilities>(CAPABILITIES_CACHE_KEY);
      if (cached) {
        if (debug) console.log('[BrowserCapabilities] Using cached results:', cached);
        return cached;
      }
    }

    if (debug) console.log('[BrowserCapabilities] Starting new detection...');

    // Detect synchronous capabilities first
    const syncCapabilities = {
      offscreenCanvas: detectOffscreenCanvas(),
      webWorkers: detectWebWorkers(),
      imageBitmap: detectImageBitmap(),
      transferableObjects: detectTransferableObjects(),
      sharedArrayBuffer: detectSharedArrayBuffer(),
      devicePixelRatio: getDevicePixelRatio(),
    };

    if (debug) console.log('[BrowserCapabilities] Synchronous capabilities detected:', syncCapabilities);

    // Detect asynchronous format support
    const [webp, avif] = await Promise.all([detectWebPSupport(timeout), detectAVIFSupport(timeout)]);

    const capabilities: BrowserCapabilities = {
      ...syncCapabilities,
      webp,
      avif,
    };

    if (debug) console.log('[BrowserCapabilities] All capabilities detected:', capabilities);

    // Store in cache
    if (useCache) {
      capabilityCache.set(CAPABILITIES_CACHE_KEY, capabilities);
    }

    return capabilities;
  }

  /**
   * Analyze performance features
   */
  async analyzePerformance(options: DetectionOptions = {}): Promise<PerformanceFeatures> {
    const capabilities = await this.detectCapabilities(options);
    return analyzePerformanceFeaturesInternal(capabilities);
  }

  /**
   * Detect individual features (synchronous)
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
 * Quick browser capability detection (using singleton)
 */
export async function detectBrowserCapabilities(options?: DetectionOptions): Promise<BrowserCapabilities> {
  const detector = BrowserCapabilityDetector.getInstance();
  return detector.detectCapabilities(options);
}

/**
 * Quick performance feature analysis (using singleton)
 */
export async function analyzePerformanceFeatures(options?: DetectionOptions): Promise<PerformanceFeatures> {
  const detector = BrowserCapabilityDetector.getInstance();
  return detector.analyzePerformance(options);
}

/**
 * Quickly detect synchronous features only
 */
export function detectSyncCapabilities(): Omit<BrowserCapabilities, 'webp' | 'avif'> {
  const detector = BrowserCapabilityDetector.getInstance();
  return detector.detectSyncFeatures();
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
 * Quick determination of optimal processing mode
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
