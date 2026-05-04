/**
 * features 퍼사드와 기능 감지 결과의 일관성을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { features } from '../../../../src/index';
import {
  BrowserCapabilityDetector,
  detectBrowserCapabilities,
  detectFormatSupport,
  detectSyncCapabilities,
} from '../../../../src/utils/browser-capabilities';

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
    const freshModule = await import('../../../../src/index');

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
    const freshModule = await import('../../../../src/index');

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
