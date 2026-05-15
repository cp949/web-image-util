import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdvancedFeatureInfo } from '../../../src/advanced-index';

describe('getAdvancedFeatureInfo()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('반환 구조', () => {
    it('version, features, plugins, performance 네 키를 반환한다', () => {
      const info = getAdvancedFeatureInfo();

      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('features');
      expect(info).toHaveProperty('plugins');
      expect(info).toHaveProperty('performance');
    });

    it('version은 문자열이다', () => {
      const info = getAdvancedFeatureInfo();

      expect(typeof info.version).toBe('string');
    });
  });

  describe('features 하위 플래그', () => {
    it('features 하위 모든 boolean 플래그 키가 존재한다', () => {
      const { features } = getAdvancedFeatureInfo();

      expect(features).toHaveProperty('pluginSystem');
      expect(features).toHaveProperty('autoHighRes');
      expect(features).toHaveProperty('smartFormat');
      expect(features).toHaveProperty('advancedWatermark');
      expect(features).toHaveProperty('batchProcessing');
    });

    it('features 하위 플래그는 모두 boolean 타입이다', () => {
      const { features } = getAdvancedFeatureInfo();

      expect(typeof features.pluginSystem).toBe('boolean');
      expect(typeof features.autoHighRes).toBe('boolean');
      expect(typeof features.smartFormat).toBe('boolean');
      expect(typeof features.advancedWatermark).toBe('boolean');
      expect(typeof features.batchProcessing).toBe('boolean');
    });
  });

  describe('performance 환경 분기 — 전역 있음', () => {
    it('Worker가 정의된 환경에서 webWorkerSupport가 true다', () => {
      vi.stubGlobal('Worker', class MockWorker {});
      vi.stubGlobal('OffscreenCanvas', undefined);
      vi.stubGlobal('createImageBitmap', undefined);

      const { performance } = getAdvancedFeatureInfo();

      expect(performance.webWorkerSupport).toBe(true);
    });

    it('OffscreenCanvas가 정의된 환경에서 offscreenCanvasSupport가 true다', () => {
      vi.stubGlobal('Worker', undefined);
      vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {});
      vi.stubGlobal('createImageBitmap', undefined);

      const { performance } = getAdvancedFeatureInfo();

      expect(performance.offscreenCanvasSupport).toBe(true);
    });

    it('createImageBitmap이 정의된 환경에서 imageBitmapSupport가 true다', () => {
      vi.stubGlobal('Worker', undefined);
      vi.stubGlobal('OffscreenCanvas', undefined);
      vi.stubGlobal('createImageBitmap', () => Promise.resolve());

      const { performance } = getAdvancedFeatureInfo();

      expect(performance.imageBitmapSupport).toBe(true);
    });

    it('세 전역이 모두 정의된 환경에서 performance 지원값이 모두 true다', () => {
      vi.stubGlobal('Worker', class MockWorker {});
      vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {});
      vi.stubGlobal('createImageBitmap', () => Promise.resolve());

      const { performance } = getAdvancedFeatureInfo();

      expect(performance.webWorkerSupport).toBe(true);
      expect(performance.offscreenCanvasSupport).toBe(true);
      expect(performance.imageBitmapSupport).toBe(true);
    });
  });

  describe('performance 환경 분기 — 전역 없음', () => {
    it('Worker가 없는 환경에서 webWorkerSupport가 false다', () => {
      vi.stubGlobal('Worker', undefined);
      vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {});
      vi.stubGlobal('createImageBitmap', () => Promise.resolve());

      const { performance } = getAdvancedFeatureInfo();

      expect(performance.webWorkerSupport).toBe(false);
    });

    it('OffscreenCanvas가 없는 환경에서 offscreenCanvasSupport가 false다', () => {
      vi.stubGlobal('Worker', class MockWorker {});
      vi.stubGlobal('OffscreenCanvas', undefined);
      vi.stubGlobal('createImageBitmap', () => Promise.resolve());

      const { performance } = getAdvancedFeatureInfo();

      expect(performance.offscreenCanvasSupport).toBe(false);
    });

    it('createImageBitmap이 없는 환경에서 imageBitmapSupport가 false다', () => {
      vi.stubGlobal('Worker', class MockWorker {});
      vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {});
      vi.stubGlobal('createImageBitmap', undefined);

      const { performance } = getAdvancedFeatureInfo();

      expect(performance.imageBitmapSupport).toBe(false);
    });

    it('세 전역이 모두 없는 환경에서 performance 지원값이 모두 false다', () => {
      vi.stubGlobal('Worker', undefined);
      vi.stubGlobal('OffscreenCanvas', undefined);
      vi.stubGlobal('createImageBitmap', undefined);

      const { performance } = getAdvancedFeatureInfo();

      expect(performance.webWorkerSupport).toBe(false);
      expect(performance.offscreenCanvasSupport).toBe(false);
      expect(performance.imageBitmapSupport).toBe(false);
    });
  });
});
