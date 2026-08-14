/**
 * 브라우저 기능 감지 편의 함수의 기본 동작을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectBrowserCapabilities, detectSyncCapabilities } from '../../../../src/utils/browser-capabilities';
import { clearCapabilityCacheForTesting } from '../../../../src/utils/browser-capabilities/cache.internal';

describe('detectSyncCapabilities (편의 함수)', () => {
  it('jsdom 환경에서 정상 감지 결과를 반환한다', () => {
    const result = detectSyncCapabilities();

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

    // webp/avif는 동기 결과에 없어야 한다
    expect(result).not.toHaveProperty('webp');
    expect(result).not.toHaveProperty('avif');
  });

  it('devicePixelRatio는 양수다', () => {
    const result = detectSyncCapabilities();
    expect(result.devicePixelRatio).toBeGreaterThan(0);
  });
});

describe('detectBrowserCapabilities (편의 함수)', () => {
  beforeEach(() => {
    clearCapabilityCacheForTesting();
  });

  afterEach(() => {
    clearCapabilityCacheForTesting();
  });

  it('모든 BrowserCapabilities 필드를 포함한 결과를 반환한다', async () => {
    const result = await detectBrowserCapabilities();

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

  describe('캐시 재사용', () => {
    it('두 번 호출해도 동일한 객체를 반환한다', async () => {
      const first = await detectBrowserCapabilities({ useCache: true });
      const second = await detectBrowserCapabilities({ useCache: true });

      // 캐시에서 같은 객체가 나와야 한다
      expect(first).toBe(second);
    });

    it('useCache: false 이면 매번 새로 감지한다', async () => {
      const first = await detectBrowserCapabilities({ useCache: false });
      const second = await detectBrowserCapabilities({ useCache: false });

      // 값은 같아도 캐시 객체는 아니므로 내용만 검증한다
      expect(first.offscreenCanvas).toBe(second.offscreenCanvas);
      expect(first.webp).toBe(second.webp);
    });

    it('clearCapabilityCacheForTesting 후 재호출하면 새로 감지한다', async () => {
      const first = await detectBrowserCapabilities({ useCache: true });
      clearCapabilityCacheForTesting();
      const second = await detectBrowserCapabilities({ useCache: true });

      // 결과 내용은 동일해야 한다 (환경이 바뀌지 않았으므로)
      expect(first.offscreenCanvas).toBe(second.offscreenCanvas);
      expect(first.webp).toBe(second.webp);
    });
  });
});
