/**
 * 감지된 브라우저 기능을 바탕으로 처리 모드와 성능 지표를 계산하는 순수 함수 모음이다.
 *
 * @description I/O 없이 입력 능력 객체만으로 결정 로직과 가중치 상수를 다룬다.
 */

import type { BrowserCapabilities, PerformanceFeatures } from './types';

/**
 * Determine optimal processing mode based on browser capabilities
 */
export function determineOptimalProcessingMode(
  capabilities: BrowserCapabilities
): 'main-thread' | 'web-worker' | 'offscreen' {
  // Priority: offscreen > web-worker > main-thread

  // 1. OffscreenCanvas + Web Workers + ImageBitmap = Best performance
  if (
    capabilities.offscreenCanvas &&
    capabilities.webWorkers &&
    capabilities.imageBitmap &&
    capabilities.transferableObjects
  ) {
    return 'offscreen';
  }

  // 2. Web Workers + Transferable Objects = Medium performance
  if (capabilities.webWorkers && capabilities.transferableObjects) {
    return 'web-worker';
  }

  // 3. Main thread processing (default)
  return 'main-thread';
}

/**
 * Analyze performance features (internal function)
 */
export function analyzePerformanceFeaturesInternal(capabilities: BrowserCapabilities): PerformanceFeatures {
  return {
    canUseOffscreenCanvas: capabilities.offscreenCanvas && capabilities.webWorkers,
    canUseWebWorkers: capabilities.webWorkers && capabilities.transferableObjects,
    canUseImageBitmap: capabilities.imageBitmap,
    recommendedProcessingMode: determineOptimalProcessingMode(capabilities),
  };
}

/**
 * Processing mode descriptions
 */
export const PROCESSING_MODE_DESCRIPTIONS = {
  offscreen: 'Highest performance processing using OffscreenCanvas + Web Worker',
  'web-worker': 'Multi-threaded processing using Web Worker',
  'main-thread': 'Processing on main thread (default, compatibility first)',
} as const;

/**
 * Performance impact weights by feature
 */
export const FEATURE_PERFORMANCE_WEIGHTS = {
  offscreenCanvas: 0.4, // 40% - Largest performance improvement
  webWorkers: 0.3, // 30% - Multi-threaded processing
  imageBitmap: 0.15, // 15% - Efficient image processing
  transferableObjects: 0.1, // 10% - Data transfer optimization
  webp: 0.03, // 3% - Small file size
  avif: 0.02, // 2% - Smaller file size
} as const;
