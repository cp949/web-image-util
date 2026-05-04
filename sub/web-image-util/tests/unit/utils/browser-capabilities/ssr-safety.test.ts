/**
 * window/document가 없는 SSR 환경에서 기능 감지가 안전한지 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { features } from '../../../../src/index';
import {
  BrowserCapabilityDetector,
  detectBrowserCapabilities,
  detectSyncCapabilities,
} from '../../../../src/utils/browser-capabilities';

/**
 * window와 document를 undefined로 만들어 SSR 환경을 흉내낸다.
 * 반환값은 복원 함수다.
 */
function simulateSSR(): () => void {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  // @ts-expect-error SSR 환경 시뮬레이션
  delete globalThis.window;
  // @ts-expect-error SSR 환경 시뮬레이션
  delete globalThis.document;

  return () => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    }
    if (originalDocument !== undefined) {
      globalThis.document = originalDocument;
    }
  };
}

describe('SSR 환경 안전성', () => {
  // features는 모듈 임포트 시점에 평가되므로 SSR 조작 대상에서 제외한다.

  it('features 객체 접근 시 예외가 발생하지 않는다', () => {
    expect(() => features.webp).not.toThrow();
    expect(() => features.avif).not.toThrow();
    expect(() => features.offscreenCanvas).not.toThrow();
    expect(() => features.imageBitmap).not.toThrow();
  });

  it('BrowserCapabilityDetector.getInstance()는 항상 인스턴스를 반환한다', () => {
    const instance = BrowserCapabilityDetector.getInstance();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(BrowserCapabilityDetector);
  });

  it('window/document 없는 SSR 환경에서 detectSyncCapabilities는 예외를 던지지 않는다', () => {
    // window와 document를 제거해 SSR 환경을 시뮬레이션한다
    const restore = simulateSSR();
    try {
      expect(() => detectSyncCapabilities()).not.toThrow();
    } finally {
      restore();
    }
  });

  it('window/document 없는 SSR 환경에서 detectSyncCapabilities 결과는 false 안전 기본값을 가진다', () => {
    // SSR 환경에서는 브라우저 API가 없으므로 offscreenCanvas/imageBitmap이 false여야 한다.
    // 참고: CapabilityCache.isSSR은 모듈 로드 시점에 평가되므로 런타임 SSR 시뮬레이션은
    // 개별 감지 함수의 try/catch 경로를 검증한다.
    const restore = simulateSSR();
    try {
      const result = detectSyncCapabilities();
      // 브라우저 전용 API(OffscreenCanvas, ImageBitmap)는 undefined가 되어 false를 반환해야 한다
      expect(result.offscreenCanvas).toBe(false);
      expect(result.imageBitmap).toBe(false);
      // devicePixelRatio는 안전 기본값 1을 반환해야 한다
      expect(result.devicePixelRatio).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it('window/document 없는 SSR 환경에서 detectBrowserCapabilities는 예외를 던지지 않는다', async () => {
    // SSR 환경에서도 async 기능 감지가 안전하게 완료되어야 한다
    const restore = simulateSSR();
    try {
      await expect(detectBrowserCapabilities({ timeout: 100 })).resolves.toBeDefined();
    } finally {
      restore();
    }
  });

  it('window/document 없는 SSR 환경에서 detectBrowserCapabilities 결과는 false 안전 기본값을 가진다', async () => {
    const restore = simulateSSR();
    try {
      const result = await detectBrowserCapabilities({ timeout: 100 });
      // 브라우저 전용 API가 없으면 false를 반환해야 한다
      expect(result.offscreenCanvas).toBe(false);
      expect(result.imageBitmap).toBe(false);
    } finally {
      restore();
    }
  });

  it('SSR에서 로드된 detector도 환경 복원 후 isServerSide를 다시 계산한다', async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    // @ts-expect-error SSR 환경 시뮬레이션
    delete globalThis.window;
    // @ts-expect-error SSR 환경 시뮬레이션
    delete globalThis.document;

    try {
      const browserCapabilitiesModule = await import('../../../../src/utils/browser-capabilities');
      const detector = browserCapabilitiesModule.BrowserCapabilityDetector.getInstance();

      expect(detector.isServerSide).toBe(true);

      globalThis.window = originalWindow;
      globalThis.document = originalDocument;

      expect(detector.isServerSide).toBe(false);
    } finally {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    }
  });
});
