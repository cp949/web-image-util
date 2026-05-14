/**
 * ensureImageElement / ensureImageElementDetailed 공개 API 행동 테스트.
 *
 * Canvas·HTMLImageElement 입력 정규화와 ResultElement 반환 형태를 검증한다.
 * 픽셀 동일성은 jsdom 신뢰 경계 밖이므로 치수·타입·에러 코드만 단정한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src/types';
import { ensureImageElement, ensureImageElementDetailed } from '../../../src/utils/converters';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('ensureImageElement / ensureImageElementDetailed 행동 (jsdom-safe)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ensureImageElement', () => {
    it('Canvas 입력 → HTMLImageElement를 반환한다', async () => {
      const canvas = createTestCanvas(100, 80, 'red');

      const result = await ensureImageElement(canvas);

      expect(result).toBeInstanceOf(HTMLImageElement);
    });

    it('Canvas 입력 → naturalWidth/naturalHeight가 원본 Canvas 크기와 일치한다', async () => {
      const canvas = createTestCanvas(100, 80, 'blue');

      const result = await ensureImageElement(canvas);

      expect(result.naturalWidth).toBe(100);
      expect(result.naturalHeight).toBe(80);
    });

    it('이미 로드된 HTMLImageElement 입력 → 동일 인스턴스를 반환한다', async () => {
      const img = document.createElement('img');
      // complete와 naturalWidth를 설정해 source-converter의 early-return 경로를 진입시킨다.
      Object.defineProperty(img, 'complete', { value: true, configurable: true });
      Object.defineProperty(img, 'naturalWidth', { value: 200, configurable: true });

      const result = await ensureImageElement(img);

      expect(result).toBe(img);
    });

    it('잘못된 입력 → ImageProcessError(INVALID_SOURCE)를 던진다', async () => {
      // ensureImageElement는 try/catch 없이 convertToImageElement를 그대로 호출한다.
      // 따라서 미지원 타입에 대해 convertToImageElement가 던지는 INVALID_SOURCE 코드를 그대로 전파한다.
      // (ensureImageElementDetailed와 달리 CONVERSION_FAILED로 래핑하지 않는다 — 의도된 비대칭)
      let caughtError: unknown;
      try {
        await ensureImageElement(null as any);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ImageProcessError);
      expect((caughtError as ImageProcessError).code).toBe('INVALID_SOURCE');
    });
  });

  describe('ensureImageElementDetailed', () => {
    it('Canvas 입력 → element·width·height·processingTime 포함한 ResultElement 반환', async () => {
      const canvas = createTestCanvas(120, 90, 'green');

      const result = await ensureImageElementDetailed(canvas);

      expect(result.element).toBeInstanceOf(HTMLImageElement);
      expect(result.width).toBe(120);
      expect(result.height).toBe(90);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('잘못된 입력 → ImageProcessError(CONVERSION_FAILED)를 던진다', async () => {
      // Detailed는 내부 try/catch로 convertToImageElement 에러를 CONVERSION_FAILED로 래핑한다.
      // (비-Detailed의 INVALID_SOURCE와 의도적으로 다른 코드 — 래핑 여부 차이)
      let caughtError: unknown;
      try {
        await ensureImageElementDetailed(null as any);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ImageProcessError);
      expect((caughtError as ImageProcessError).code).toBe('CONVERSION_FAILED');
    });
  });
});
