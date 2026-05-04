/**
 * 브라우저 기능 감지 detector와 편의 함수의 기본 동작을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BrowserCapabilityDetector,
  detectBrowserCapabilities,
  detectSyncCapabilities,
} from '../../../../src/utils/browser-capabilities';

describe('BrowserCapabilityDetector', () => {
  let detector: BrowserCapabilityDetector;

  beforeEach(() => {
    // 매 테스트마다 싱글턴 캐시를 초기화한다
    detector = BrowserCapabilityDetector.getInstance();
    detector.clearCache();
  });

  afterEach(() => {
    detector.clearCache();
  });

  describe('detectSyncFeatures', () => {
    it('happy-dom 환경에서 정상 감지 결과를 반환한다', () => {
      const result = detector.detectSyncFeatures();

      // 모든 필드가 존재해야 한다
      expect(result).toHaveProperty('offscreenCanvas');
      expect(result).toHaveProperty('webWorkers');
      expect(result).toHaveProperty('imageBitmap');
      expect(result).toHaveProperty('transferableObjects');
      expect(result).toHaveProperty('sharedArrayBuffer');
      expect(result).toHaveProperty('devicePixelRatio');

      // 타입 검증
      expect(typeof result.offscreenCanvas).toBe('boolean');
      expect(typeof result.webWorkers).toBe('boolean');
      expect(typeof result.devicePixelRatio).toBe('number');
    });

    it('devicePixelRatio는 양수다', () => {
      const result = detector.detectSyncFeatures();
      expect(result.devicePixelRatio).toBeGreaterThan(0);
    });
  });

  describe('detectCapabilities (async)', () => {
    it('모든 BrowserCapabilities 필드를 포함한 결과를 반환한다', async () => {
      const result = await detector.detectCapabilities();

      expect(result).toHaveProperty('offscreenCanvas');
      expect(result).toHaveProperty('webWorkers');
      expect(result).toHaveProperty('imageBitmap');
      expect(result).toHaveProperty('transferableObjects');
      expect(result).toHaveProperty('sharedArrayBuffer');
      expect(result).toHaveProperty('devicePixelRatio');
      expect(result).toHaveProperty('webp');
      expect(result).toHaveProperty('avif');

      expect(typeof result.webp).toBe('boolean');
      expect(typeof result.avif).toBe('boolean');
    });
  });

  describe('캐시 재사용', () => {
    it('두 번 호출해도 동일한 객체를 반환한다', async () => {
      const first = await detector.detectCapabilities({ useCache: true });
      const second = await detector.detectCapabilities({ useCache: true });

      // 캐시에서 같은 결과가 나와야 한다
      expect(first).toEqual(second);
    });

    it('useCache: false 이면 매번 새로 감지한다', async () => {
      const first = await detector.detectCapabilities({ useCache: false });
      const second = await detector.detectCapabilities({ useCache: false });

      // 값은 같아도 캐시 객체는 아니므로 내용만 검증한다
      expect(first.offscreenCanvas).toBe(second.offscreenCanvas);
      expect(first.webp).toBe(second.webp);
    });

    it('clearCache 후 재호출하면 새로 감지한다', async () => {
      const first = await detector.detectCapabilities({ useCache: true });
      detector.clearCache();
      const second = await detector.detectCapabilities({ useCache: true });

      // 결과 내용은 동일해야 한다 (환경이 바뀌지 않았으므로)
      expect(first.offscreenCanvas).toBe(second.offscreenCanvas);
      expect(first.webp).toBe(second.webp);
    });
  });
});

describe('detectBrowserCapabilities (편의 함수)', () => {
  beforeEach(() => {
    BrowserCapabilityDetector.getInstance().clearCache();
  });

  afterEach(() => {
    BrowserCapabilityDetector.getInstance().clearCache();
  });

  it('BrowserCapabilities 전체 결과를 반환한다', async () => {
    const result = await detectBrowserCapabilities();

    expect(result).toHaveProperty('webp');
    expect(result).toHaveProperty('avif');
    expect(result).toHaveProperty('offscreenCanvas');
    expect(result).toHaveProperty('imageBitmap');
  });
});

describe('detectSyncCapabilities (편의 함수)', () => {
  it('webp/avif를 제외한 동기 기능 감지 결과를 반환한다', () => {
    const result = detectSyncCapabilities();

    expect(result).toHaveProperty('offscreenCanvas');
    expect(result).toHaveProperty('webWorkers');
    expect(result).toHaveProperty('imageBitmap');
    // webp/avif는 동기 결과에 없어야 한다
    expect(result).not.toHaveProperty('webp');
    expect(result).not.toHaveProperty('avif');
  });
});
