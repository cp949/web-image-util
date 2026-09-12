/**
 * size-budget.internal.ts 단위 테스트.
 *
 * 축 길이(변)·면적·입력/출력 픽셀 수 다섯 함수를 각각 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertAxisWithinSafeLimit,
  assertInputPixelBudget,
  assertOutputPixelBudget,
  precheckInputPixelBudget,
  warnIfCanvasAreaExceedsSafeLimit,
} from '../../../src/base/size-budget.internal';
import {
  resetCanvasLimitProbe,
  setCanvasLimitProbe,
} from '../../../src/utils/browser-capabilities/canvas-limits.internal';
import { productionLog } from '../../../src/utils/debug.internal';

describe('assertAxisWithinSafeLimit', () => {
  afterEach(() => resetCanvasLimitProbe());

  it('브라우저 안전 상한 이하면 통과한다', () => {
    setCanvasLimitProbe({ read: () => 1000 });
    expect(() => assertAxisWithinSafeLimit(1000, 500)).not.toThrow();
  });

  it('한 변이라도 상한을 넘으면 DIMENSION_TOO_LARGE를 던진다', () => {
    setCanvasLimitProbe({ read: () => 1000 });
    expect(() => assertAxisWithinSafeLimit(1001, 500)).toThrow(
      expect.objectContaining({ code: 'DIMENSION_TOO_LARGE' })
    );
    expect(() => assertAxisWithinSafeLimit(500, 1001)).toThrow(
      expect.objectContaining({ code: 'DIMENSION_TOO_LARGE' })
    );
  });
});

describe('warnIfCanvasAreaExceedsSafeLimit', () => {
  afterEach(() => {
    resetCanvasLimitProbe();
    vi.restoreAllMocks();
  });

  it('면적이 상한의 제곱을 넘으면 경고만 하고 던지지 않는다', () => {
    setCanvasLimitProbe({ read: () => 100 });
    const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
    expect(() => warnIfCanvasAreaExceedsSafeLimit(200, 200)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('면적이 상한 이하면 경고하지 않는다', () => {
    setCanvasLimitProbe({ read: () => 100 });
    const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
    warnIfCanvasAreaExceedsSafeLimit(50, 50);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('assertOutputPixelBudget', () => {
  it('maxOutputPixels가 undefined면 아무 검사도 하지 않는다', () => {
    expect(() => assertOutputPixelBudget(100_000, 100_000, undefined)).not.toThrow();
  });

  it('정확히 한도와 같으면 통과한다(경계값)', () => {
    expect(() => assertOutputPixelBudget(100, 100, 10_000)).not.toThrow();
  });

  it('한도를 넘으면 PIXEL_BUDGET_EXCEEDED를 던진다', () => {
    expect(() => assertOutputPixelBudget(101, 100, 10_000)).toThrow(
      expect.objectContaining({
        code: 'PIXEL_BUDGET_EXCEEDED',
        details: expect.objectContaining({ direction: 'output', actualPixels: 10_100, maxPixels: 10_000 }),
      })
    );
  });

  it('output 위반에는 stage가 없다', () => {
    try {
      assertOutputPixelBudget(101, 100, 10_000);
      throw new Error('던져야 하는데 통과했다');
    } catch (error) {
      expect((error as { details?: { stage?: unknown } }).details?.stage).toBeUndefined();
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('maxOutputPixels가 %s면 OPTION_INVALID다', (value) => {
    expect(() => assertOutputPixelBudget(10, 10, value)).toThrow(expect.objectContaining({ code: 'OPTION_INVALID' }));
  });
});

describe('assertInputPixelBudget', () => {
  function makeImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'naturalWidth', { value: naturalWidth, configurable: true });
    Object.defineProperty(canvas, 'naturalHeight', { value: naturalHeight, configurable: true });
    return canvas as unknown as HTMLImageElement;
  }

  it('maxInputPixels가 undefined면 아무 검사도 하지 않는다', () => {
    expect(() => assertInputPixelBudget(makeImage(100_000, 100_000), undefined)).not.toThrow();
  });

  it('naturalWidth*naturalHeight가 한도를 넘으면 stage: decoded로 거부한다', () => {
    expect(() => assertInputPixelBudget(makeImage(101, 100), 10_000)).toThrow(
      expect.objectContaining({
        code: 'PIXEL_BUDGET_EXCEEDED',
        details: expect.objectContaining({
          direction: 'input',
          stage: 'decoded',
          actualPixels: 10_100,
          maxPixels: 10_000,
        }),
      })
    );
  });

  it('한도 이하면 통과한다', () => {
    expect(() => assertInputPixelBudget(makeImage(100, 100), 10_000)).not.toThrow();
  });
});

describe('precheckInputPixelBudget', () => {
  function pngBytes(width: number, height: number): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width, false);
    view.setUint32(20, height, false);
    return bytes;
  }

  it('maxInputPixels가 undefined면 아무 것도 읽지 않고 통과한다', async () => {
    await expect(precheckInputPixelBudget(new ArrayBuffer(0), undefined)).resolves.toBeUndefined();
  });

  it('ArrayBuffer 소스에서 PNG 헤더를 읽어 한도를 넘으면 stage: header로 거부한다', async () => {
    const buffer = pngBytes(1000, 1000).buffer;
    await expect(precheckInputPixelBudget(buffer, 10_000)).rejects.toMatchObject({
      code: 'PIXEL_BUDGET_EXCEEDED',
      details: { direction: 'input', stage: 'header', actualPixels: 1_000_000, maxPixels: 10_000 },
    });
  });

  it('Uint8Array 소스도 동일하게 검사한다', async () => {
    await expect(precheckInputPixelBudget(pngBytes(1000, 1000), 10_000)).rejects.toMatchObject({
      code: 'PIXEL_BUDGET_EXCEEDED',
    });
  });

  it('Blob 소스는 readBlobAsArrayBuffer 경로로 읽는다', async () => {
    const blob = new Blob([pngBytes(1000, 1000)]);
    await expect(precheckInputPixelBudget(blob, 10_000)).rejects.toMatchObject({
      code: 'PIXEL_BUDGET_EXCEEDED',
    });
  });

  it('헤더 파싱이 실패하면(JPEG 등) 조용히 통과한다 — fail-open', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);
    await expect(precheckInputPixelBudget(jpeg, 1)).resolves.toBeUndefined();
  });

  it('문자열/Element 소스는 대상이 아니므로 통과한다', async () => {
    await expect(precheckInputPixelBudget('https://example.com/a.png', 1)).resolves.toBeUndefined();
  });

  it('한도 이하면 통과한다', async () => {
    await expect(precheckInputPixelBudget(pngBytes(50, 50), 10_000)).resolves.toBeUndefined();
  });

  it('선두 바이트를 읽을 수 없으면(예: detach된 ArrayBuffer) 조용히 통과한다 — fail-open', async () => {
    const buffer = new ArrayBuffer(24);
    new MessageChannel().port1.postMessage(buffer, [buffer]); // transfer -> detach
    await expect(precheckInputPixelBudget(buffer, 10_000)).resolves.toBeUndefined();
  });

  it('Blob 본문 읽기 자체가 실패해도 조용히 통과한다 — fail-open', async () => {
    const arrayBufferSpy = vi.spyOn(Blob.prototype, 'arrayBuffer').mockRejectedValueOnce(new Error('blob read error'));
    const blob = new Blob([pngBytes(1000, 1000)]);
    try {
      await expect(precheckInputPixelBudget(blob, 10_000)).resolves.toBeUndefined();
      expect(arrayBufferSpy).toHaveBeenCalledTimes(1);
    } finally {
      arrayBufferSpy.mockRestore();
    }
  });
});
