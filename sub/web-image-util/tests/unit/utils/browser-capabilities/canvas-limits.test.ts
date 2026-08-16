/**
 * Canvas 최대 안전 치수 모듈의 characterization 테스트다.
 *
 * probe 주입/해제, fallback 적용을 다룬다. 기본(userAgent) probe는 navigator.userAgent를
 * 손쉽게 stub할 수 있어 memory.internal.ts와 달리 이 파일에서 직접 분기까지 검증한다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  readMaxSafeCanvasDimension,
  resetCanvasLimitProbe,
  setCanvasLimitProbe,
} from '../../../../src/utils/browser-capabilities/canvas-limits.internal';

const originalUA = navigator.userAgent;

/** 기본 probe의 브라우저 분기 테스트를 위해 navigator.userAgent를 교체한다. */
function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
    writable: true,
  });
}

describe('readMaxSafeCanvasDimension', () => {
  afterEach(() => {
    resetCanvasLimitProbe();
  });

  it('probe가 값을 반환하면 그 값을 그대로 돌려준다', () => {
    setCanvasLimitProbe({ read: () => 32767 });

    expect(readMaxSafeCanvasDimension()).toBe(32767);
  });

  it('probe가 undefined를 반환하면 단일 fallback 값(16384)을 돌려준다', () => {
    setCanvasLimitProbe({ read: () => undefined });

    expect(readMaxSafeCanvasDimension()).toBe(16384);
  });

  it('resetCanvasLimitProbe 이후에는 기본 userAgent probe로 돌아간다', () => {
    setCanvasLimitProbe({ read: () => 1 });
    resetCanvasLimitProbe();
    setUserAgent('UnknownBrowser/1.0');

    expect(readMaxSafeCanvasDimension()).toBe(16384);
  });
});

describe('기본 userAgent probe', () => {
  afterEach(() => {
    resetCanvasLimitProbe();
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      configurable: true,
      writable: true,
    });
  });

  it('Chrome UA에서 32767을 반환한다', () => {
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    expect(readMaxSafeCanvasDimension()).toBe(32767);
  });

  it('Firefox UA에서 32767을 반환한다', () => {
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0');
    expect(readMaxSafeCanvasDimension()).toBe(32767);
  });

  it('Safari UA에서 16384를 반환한다', () => {
    // chrome/chromium이 없고 safari만 있는 순수 Safari UA
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    );
    expect(readMaxSafeCanvasDimension()).toBe(16384);
  });

  it('Edge UA에서 32767을 반환한다', () => {
    // chrome 없이 edg/만 있는 Edge UA
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/120.0.0.0');
    expect(readMaxSafeCanvasDimension()).toBe(32767);
  });

  it('알 수 없는 UA에서 기본값 16384를 반환한다', () => {
    setUserAgent('UnknownBrowser/1.0');
    expect(readMaxSafeCanvasDimension()).toBe(16384);
  });
});
