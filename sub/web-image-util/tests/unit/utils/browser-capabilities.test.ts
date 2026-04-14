/**
 * 브라우저 기능 감지 모듈 단위 테스트다.
 *
 * 검증 항목:
 * - SSR 환경 안전성 (window/document undefined)
 * - 캐시 재사용 (두 번 호출해도 동일 결과)
 * - features 퍼사드와 async 기능 감지 결과 일관성
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { features } from '../../../src/index';
import {
  BrowserCapabilityDetector,
  detectBrowserCapabilities,
  detectFormatSupport,
  detectSyncCapabilities,
} from '../../../src/utils/browser-capabilities';

// ============================================================================
// SSR 환경 시뮬레이션 헬퍼
// ============================================================================

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

// ============================================================================
// 테스트
// ============================================================================

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

// ============================================================================
// 편의 함수 테스트
// ============================================================================

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

// ============================================================================
// features 퍼사드 일관성 테스트
// ============================================================================

describe('features 퍼사드 일관성', () => {
  beforeEach(() => {
    BrowserCapabilityDetector.getInstance().clearCache();
  });

  afterEach(() => {
    BrowserCapabilityDetector.getInstance().clearCache();
  });

  it('features.offscreenCanvas는 detectSyncCapabilities().offscreenCanvas와 일치한다', () => {
    const syncResult = detectSyncCapabilities();
    // features는 모듈 로드 시점에 평가된 값이므로 타입만 검증한다
    expect(typeof features.offscreenCanvas).toBe('boolean');
    expect(typeof syncResult.offscreenCanvas).toBe('boolean');
    // happy-dom 환경에서는 동일해야 한다
    expect(features.offscreenCanvas).toBe(syncResult.offscreenCanvas);
  });

  it('features.imageBitmap은 detectSyncCapabilities().imageBitmap과 일치한다', () => {
    const syncResult = detectSyncCapabilities();
    expect(features.imageBitmap).toBe(syncResult.imageBitmap);
  });

  it('features 필드가 모두 boolean 타입이다', () => {
    expect(typeof features.webp).toBe('boolean');
    expect(typeof features.avif).toBe('boolean');
    expect(typeof features.offscreenCanvas).toBe('boolean');
    expect(typeof features.imageBitmap).toBe('boolean');
  });

  it('비동기 캐시가 비어 있어도 features.webp는 레거시 동기 감지와 같은 값을 반환한다', async () => {
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          toDataURL(type?: string) {
            if (type === 'image/webp') {
              return 'data:image/webp;base64,legacy-sync-detection';
            }

            return `data:${type ?? 'image/png'};base64,fallback`;
          },
        } as HTMLCanvasElement;
      }

      return originalCreateElement(tagName);
    });

    vi.resetModules();
    const freshModule = await import('../../../src/index');

    expect(freshModule.features.webp).toBe(true);
  });

  it('비동기 캐시가 비어 있어도 features.avif는 레거시 동기 감지와 같은 값을 반환한다', async () => {
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          toDataURL(type?: string) {
            if (type === 'image/avif') {
              return 'data:image/avif;base64,legacy-sync-detection';
            }

            return `data:${type ?? 'image/png'};base64,fallback`;
          },
        } as HTMLCanvasElement;
      }

      return originalCreateElement(tagName);
    });

    vi.resetModules();
    const freshModule = await import('../../../src/index');

    expect(freshModule.features.avif).toBe(true);
  });

  it('detectFormatSupport()가 캐시를 채우면 features.webp/avif도 같은 값을 본다', async () => {
    const formatSupport = await detectFormatSupport();

    expect(features.webp).toBe(formatSupport.webp);
    expect(features.avif).toBe(formatSupport.avif);
  });

  it('async detectBrowserCapabilities의 offscreenCanvas와 features가 일치한다', async () => {
    const asyncResult = await detectBrowserCapabilities();
    expect(features.offscreenCanvas).toBe(asyncResult.offscreenCanvas);
  });

  it('async detectBrowserCapabilities의 imageBitmap과 features가 일치한다', async () => {
    const asyncResult = await detectBrowserCapabilities();
    expect(features.imageBitmap).toBe(asyncResult.imageBitmap);
  });

  it('async detectBrowserCapabilities의 webp/avif와 features가 일치한다', async () => {
    const asyncResult = await detectBrowserCapabilities();

    expect(features.webp).toBe(asyncResult.webp);
    expect(features.avif).toBe(asyncResult.avif);
  });
});

// ============================================================================
// SSR 환경 안전성 테스트
// ============================================================================

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
      const browserCapabilitiesModule = await import('../../../src/utils/browser-capabilities');
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
