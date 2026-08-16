/**
 * composeImages() 공통 계약 테스트
 *
 * spec 종류와 무관한 입력 검증, canvas 상한, 반올림, 소유권을 검증한다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { type ComposeSpec, composeImages } from '../../../src/composition/compose';
import {
  resetCanvasLimitProbe,
  setCanvasLimitProbe,
} from '../../../src/utils/browser-capabilities/canvas-limits.internal';
import { createTestCanvas, getCanvasPixelData } from '../../utils/canvas-helper';

/** node-canvas가 drawImage 소스로 수락하는 색 지정 Canvas를 만든다. */
function createColorSource(width: number, height: number, color: string): HTMLImageElement {
  const canvas = createTestCanvas(width, height, color);
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

describe('composeImages — 공통', () => {
  afterEach(() => {
    resetCanvasLimitProbe();
  });

  it('알 수 없는 spec type은 PROCESSING_FAILED를 던진다', async () => {
    const spec = { type: 'mosaic' } as unknown as ComposeSpec;
    await expect(composeImages(spec)).rejects.toMatchObject({ code: 'PROCESSING_FAILED' });
  });

  it('로드되지 않은(크기 0) 이미지가 섞이면 INVALID_SOURCE를 던진다', async () => {
    const zero = createColorSource(0, 0, 'red');
    const normal = createColorSource(20, 20, 'red');

    await expect(composeImages({ type: 'grid', images: [normal, zero] })).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
    await expect(
      composeImages({ type: 'layers', width: 50, height: 50, layers: [{ image: zero, x: 0, y: 0 }] })
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
    await expect(composeImages({ type: 'collage', images: [zero], width: 100, height: 100 })).rejects.toMatchObject({
      code: 'INVALID_SOURCE',
    });
  });

  it('이미지 자리에 null이 오면 raw TypeError가 아니라 INVALID_SOURCE를 던진다', async () => {
    const nullImage = null as unknown as HTMLImageElement;
    await expect(
      composeImages({ type: 'layers', width: 50, height: 50, layers: [{ image: nullImage, x: 0, y: 0 }] })
    ).rejects.toMatchObject({ code: 'INVALID_SOURCE' });
  });

  it('fallback 상한에서 canvas 한 변이 16384px를 넘으면 할당 전에 거부한다', async () => {
    await expect(composeImages({ type: 'layers', width: 20000, height: 100, layers: [] })).rejects.toMatchObject({
      code: 'DIMENSION_TOO_LARGE',
    });

    const huge = createColorSource(100, 100, 'red');
    Object.defineProperty(huge, 'naturalWidth', { value: 9000, configurable: true });
    Object.defineProperty(huge, 'naturalHeight', { value: 9000, configurable: true });
    await expect(composeImages({ type: 'grid', images: [huge, huge], columns: 2 })).rejects.toMatchObject({
      code: 'DIMENSION_TOO_LARGE',
    });
  });

  it('probe가 chrome급 상한(32767)을 돌려주면 그 값을 실제 거부 기준으로 쓴다', async () => {
    setCanvasLimitProbe({ read: () => 32767 });

    const canvas = await composeImages({ type: 'layers', width: 20000, height: 100, layers: [] });
    expect(canvas.width).toBe(20000);

    await expect(composeImages({ type: 'layers', width: 40000, height: 100, layers: [] })).rejects.toMatchObject({
      code: 'DIMENSION_TOO_LARGE',
    });
  });

  it('비정수 canvas 크기는 반올림된다 — 0으로 반올림되면 INVALID_DIMENSIONS', async () => {
    const canvas = await composeImages({ type: 'layers', width: 100.6, height: 50.4, layers: [] });
    expect(canvas.width).toBe(101);
    expect(canvas.height).toBe(50);

    await expect(composeImages({ type: 'layers', width: 0.4, height: 10, layers: [] })).rejects.toMatchObject({
      code: 'INVALID_DIMENSIONS',
    });
  });

  it('반환 canvas는 호출자 소유다 — 이후 호출이 이전 결과를 변경하지 않는다', async () => {
    const red = createColorSource(10, 10, 'red');
    const blue = createColorSource(10, 10, 'blue');

    const first = await composeImages({
      type: 'layers',
      width: 10,
      height: 10,
      layers: [{ image: red, x: 0, y: 0 }],
    });
    await composeImages({ type: 'layers', width: 10, height: 10, layers: [{ image: blue, x: 0, y: 0 }] });

    const px = getCanvasPixelData(first, 5, 5);
    expect([px.r, px.g, px.b]).toEqual([255, 0, 0]);
  });
});
