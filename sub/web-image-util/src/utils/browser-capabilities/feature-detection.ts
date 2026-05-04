/**
 * 브라우저 환경의 동기적 기능 지원 여부를 감지하는 함수 모음이다.
 *
 * @description Worker, ImageBitmap, Transferable 등 비-포맷 계열 능력을 다룬다.
 * SSR 환경에서는 모든 함수가 보수적인 false/기본값을 반환한다.
 */

import { capabilityCache } from './cache';

/**
 * Detect OffscreenCanvas support
 */
export function detectOffscreenCanvas(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    return typeof OffscreenCanvas !== 'undefined' && typeof OffscreenCanvas.prototype.getContext === 'function';
  } catch {
    return false;
  }
}

/**
 * Detect Web Workers support
 */
export function detectWebWorkers(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    return typeof Worker !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Detect ImageBitmap support
 */
export function detectImageBitmap(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    return typeof ImageBitmap !== 'undefined' && typeof createImageBitmap === 'function';
  } catch {
    return false;
  }
}

/**
 * Detect Transferable Objects support
 */
export function detectTransferableObjects(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    // Test using MessageChannel
    const channel = new MessageChannel();
    const buffer = new ArrayBuffer(8);

    // Check transferable capability synchronously
    return typeof channel.port1.postMessage === 'function' && buffer instanceof ArrayBuffer;
  } catch {
    return false;
  }
}

/**
 * Detect SharedArrayBuffer support
 */
export function detectSharedArrayBuffer(): boolean {
  if (capabilityCache.isServerSide) return false;

  try {
    return typeof SharedArrayBuffer !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Get device pixel ratio
 */
export function getDevicePixelRatio(): number {
  if (capabilityCache.isServerSide) return 1;

  try {
    return globalThis.devicePixelRatio || 1;
  } catch {
    return 1;
  }
}
